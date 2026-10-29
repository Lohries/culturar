import * as THREE from "three";

/*
  Giroscópio → orientação da câmera virtual.
  Mesma conversão do antigo DeviceOrientationControls do three.js.
  Sem giroscópio (computador), arrastar com o mouse/dedo gira a vista.
*/
const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // câmera olha para fora da traseira
const GRAU = Math.PI / 180;

// Precisa ser chamado dentro de um toque/clique (exigência do iPhone).
export function pedirPermissaoMovimento() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") {
    return D.requestPermission().then((r) => r === "granted").catch(() => false);
  }
  return Promise.resolve(true);
}

export class Orientacao {
  constructor(alvo) {
    this.alvo = alvo;
    this.evento = null;
    this.temGiroscopio = false;
    this.alinhamento = new THREE.Quaternion(); // gira o mundo para a obra ficar à sua frente
    this.precisaAlinhar = true;
    this.arrasto = { yaw: 0, pitch: 0 };
    this.qDispositivo = new THREE.Quaternion();
    this.saida = new THREE.Quaternion();

    this._onOri = (e) => {
      if (e.alpha == null && e.beta == null) return;
      this.evento = e;
      this.temGiroscopio = true;
    };
    addEventListener("deviceorientation", this._onOri);

    // arrasto
    this._ptr = null;
    this._down = (e) => { this._ptr = { x: e.clientX, y: e.clientY, yaw: this.arrasto.yaw, pitch: this.arrasto.pitch }; };
    this._move = (e) => {
      if (!this._ptr || this.temGiroscopio) return;
      const s = 0.25 * GRAU;
      this.arrasto.yaw = this._ptr.yaw + (e.clientX - this._ptr.x) * s;
      this.arrasto.pitch = THREE.MathUtils.clamp(this._ptr.pitch + (e.clientY - this._ptr.y) * s, -1.3, 1.3);
    };
    this._up = () => { this._ptr = null; };
    alvo.addEventListener("pointerdown", this._down);
    addEventListener("pointermove", this._move);
    addEventListener("pointerup", this._up);
    addEventListener("pointercancel", this._up);
  }

  realinhar() { this.precisaAlinhar = true; this.arrasto.yaw = 0; this.arrasto.pitch = 0; }

  // frontal = true → câmera virtual olha para o lado da tela (modo selfie)
  atualizar(camera, frontal = false) {
    if (this.temGiroscopio && this.evento) {
      const e = this.evento;
      const orient = (screen.orientation?.angle ?? window.orientation ?? 0) * GRAU;
      euler.set((e.beta || 0) * GRAU, (e.alpha || 0) * GRAU, -(e.gamma || 0) * GRAU, "YXZ");
      this.qDispositivo.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient));

      if (this.precisaAlinhar) {
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.qDispositivo);
        const yaw = Math.atan2(-f.x, -f.z);
        this.alinhamento.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
        this.precisaAlinhar = false;
      }
      this.saida.copy(this.alinhamento).multiply(this.qDispositivo);
    } else {
      euler.set(this.arrasto.pitch, this.arrasto.yaw, 0, "YXZ");
      this.saida.setFromEuler(euler);
    }
    if (frontal) this.saida.multiply(q0.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    camera.quaternion.copy(this.saida);
  }

  destruir() {
    removeEventListener("deviceorientation", this._onOri);
    this.alvo.removeEventListener("pointerdown", this._down);
    removeEventListener("pointermove", this._move);
    removeEventListener("pointerup", this._up);
    removeEventListener("pointercancel", this._up);
  }
}
