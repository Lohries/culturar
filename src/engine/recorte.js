import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

/*
  Recorta a pessoa da câmera frontal em tempo real (MediaPipe Selfie Segmenter, roda no aparelho).
  Resultado: um canvas com você e fundo transparente, atualizado a cada quadro.
*/
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODELO =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

let promessa = null;
function criarSegmentador() {
  if (!promessa) {
    promessa = (async () => {
      const fs = await FilesetResolver.forVisionTasks(WASM);
      const opcoes = (delegate) => ({
        baseOptions: { modelAssetPath: MODELO, delegate },
        runningMode: "VIDEO",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
      try { return await ImageSegmenter.createFromOptions(fs, opcoes("GPU")); }
      catch { return await ImageSegmenter.createFromOptions(fs, opcoes("CPU")); }
    })();
    promessa.catch(() => { promessa = null; });
  }
  return promessa;
}

export class Recorte {
  constructor() {
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;
    this.canvas = document.createElement("canvas"); // você, sem fundo
    this.mascara = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.mctx = this.mascara.getContext("2d");
    this.segmentador = null;
    this.ultimo = -1;
    this.pronto = false;
  }

  async iniciar() {
    const [stream, seg] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      criarSegmentador(),
    ]);
    this.stream = stream;
    this.segmentador = seg;
    this.video.srcObject = stream;
    await this.video.play();
    this.pronto = true;
  }

  // Chamado a cada quadro. Retorna true quando o canvas mudou.
  atualizar() {
    const v = this.video;
    if (!this.pronto || v.readyState < 2 || v.currentTime === this.ultimo) return false;
    this.ultimo = v.currentTime;
    const w = v.videoWidth, h = v.videoHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }

    const r = this.segmentador.segmentForVideo(v, performance.now());
    const m = r.confidenceMasks?.[0];
    if (m) {
      const mw = m.width, mh = m.height, conf = m.getAsFloat32Array();
      if (this.mascara.width !== mw || this.mascara.height !== mh) { this.mascara.width = mw; this.mascara.height = mh; this.im = this.mctx.createImageData(mw, mh); }
      const d = this.im.data;
      for (let i = 0; i < conf.length; i++) {
        const a = Math.min(1, Math.max(0, (conf[i] - 0.35) / 0.4)); // borda mais definida
        d[i * 4 + 3] = a * 255;
      }
      this.mctx.putImageData(this.im, 0, 0);
    }
    r.close?.();

    const c = this.ctx;
    c.save();
    c.clearRect(0, 0, w, h);
    c.filter = `blur(${Math.max(1, Math.round(w / 640))}px)`;
    c.drawImage(this.mascara, 0, 0, w, h);
    c.filter = "none";
    c.globalCompositeOperation = "source-in";
    c.drawImage(v, 0, 0, w, h);
    c.restore();
    return true;
  }

  parar() {
    this.pronto = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
