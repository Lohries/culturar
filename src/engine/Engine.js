import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Orientacao } from "./orientacao.js";

/*
  A cena:
  - A pintura vira uma "casca" 360° ao seu redor. Cada pixel é empurrado para a distância que o mapa de
    profundidade indica, então o primeiro plano fica perto e o fundo fica longe.
  - A tela ocupa `campo` graus à sua frente; o resto do círculo é a mesma tela espelhada, que encaixa sem
    emenda. Acima e abaixo dela, céu e chão continuam a partir das bordas, desfocados.
  - Portal: com a câmera traseira ligada, uma moldura dourada flutua à sua frente e mostra a cena por dentro
    (máscara de stencil). "Atravessar" leva você através da moldura.
  - Selfie: a câmera virtual olha para trás de você e o seu recorte aparece na frente da cena.
*/

const VERT = /* glsl */ `
  attribute vec2 ll;               // longitude, latitude (rad)
  uniform sampler2D depthMap;
  uniform float temProfundidade, campo, faixaV, horizonte, perto, longe, olho;
  varying vec2 vUv;
  varying float vExcesso, vDist;

  float espelhar(float u) { float f = mod(u, 2.0); return f < 1.0 ? f : 2.0 - f; }

  float raio(vec2 lonlat, out vec2 uv, out float vn) {
    float u = lonlat.x / campo + 0.5;
    vn = horizonte - lonlat.y / faixaV;           // 0 = topo da tela, 1 = base
    float ue = espelhar(u);
    uv = vec2(ue, 1.0 - vn);
    float vc = clamp(vn, 0.0, 1.0);
    float d = temProfundidade > 0.5
      ? texture2D(depthMap, vec2(ue, vc)).r
      : smoothstep(horizonte - 0.02, 1.05, vc);   // sem IA: chão se aproxima de baixo para cima
    float r = mix(longe, perto, pow(d, 1.5));
    if (lonlat.y < -0.02) {                       // abaixo da tela: chão plano
      float rc = min(olho / sin(-lonlat.y), longe);
      r = mix(r, rc, smoothstep(0.0, 0.08, vn - 1.0));
    }
    if (vn < 0.0) r = mix(r, longe, smoothstep(0.0, 0.06, -vn));
    return r;
  }

  void main() {
    vec2 uv; float vn;
    float r = raio(ll, uv, vn);
    vec3 dir = vec3(cos(ll.y) * sin(ll.x), sin(ll.y), -cos(ll.y) * cos(ll.x));
    vUv = uv;
    vExcesso = vn < 0.0 ? -vn : max(vn - 1.0, 0.0);
    vDist = r;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * r, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 corNevoa;
  uniform float longe, revelar;
  varying vec2 vUv;
  varying float vExcesso, vDist;
  void main() {
    float lod = clamp(vExcesso * 22.0, 0.0, 7.0);
    vec4 c = textureLod(map, vec2(vUv.x, clamp(vUv.y, 0.002, 0.998)), lod);
    // perspectiva aérea leve; a mistura é feita em espaço perceptual para não "lavar" os escuros
    float n = smoothstep(longe * 0.5, longe, vDist) * 0.12 + smoothstep(0.0, 0.45, vExcesso) * 0.35;
    vec3 col = pow(mix(sqrt(c.rgb), sqrt(corNevoa), n), vec3(2.0));
    gl_FragColor = vec4(col * revelar, 1.0);
    #include <colorspace_fragment>
  }
`;

const VERT_PESSOA = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Dá ao seu recorte o tom da pintura: cores mais quentes, um pouco menos saturadas, leve pinceladura.
const FRAG_PESSOA = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 tom;
  uniform float pintura;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.02) discard;
    float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 g = mix(vec3(l), c.rgb, 1.0 - 0.25 * pintura);
    g = mix(g, g * tom * 1.7, 0.35 * pintura);
    g = mix(g, floor(g * 18.0 + 0.5) / 18.0, 0.4 * pintura);
    g *= 1.0 - 0.06 * pintura;
    gl_FragColor = vec4(g, c.a);
    #include <colorspace_fragment>
  }
`;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Engine {
  constructor(canvas, { obra, img }) {
    this.canvas = canvas;
    this.obra = obra;
    this.amb = obra.ambiente;
    this.fase = "parado"; // parado | portal | travessia | dentro
    this.modo = "olhar"; // olhar | selfie
    this.aoQuadro = null;
    this.relogio = new THREE.Timer();

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, stencil: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400);
    this.scene.add(this.camera);
    this.orientacao = new Orientacao(canvas);

    this._criarDiorama(img);
    this._criarPoeira();
    this._criarMoldura(img);
    this._criarPessoa();

    this._redim = () => {
      const p = canvas.parentElement;
      const w = p.clientWidth, h = p.clientHeight;
      r.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this._posicionarMoldura();
      this._ajustarPessoa();
    };
    this._ro = new ResizeObserver(this._redim);
    this._ro.observe(canvas.parentElement);
    this._redim();

    this._loop = this._loop.bind(this);
    r.setAnimationLoop(this._loop);
  }

  // ---------------- construção ----------------
  _criarDiorama(img) {
    const amb = this.amb;
    const campo = THREE.MathUtils.degToRad(amb.campo);
    const aspecto = img.naturalHeight / img.naturalWidth;
    this.faixaV = campo * aspecto; // ângulo vertical ocupado pela tela

    // grade lon × lat cobrindo a esfera
    // modo leve (celulares fracos): localStorage.setItem("culturar-leve", "1")
    let leve = false;
    try { leve = localStorage.getItem("culturar-leve") === "1"; } catch { /* sem storage */ }
    const [NX, NY] = leve ? [360, 150] : [900, 360];
    const latMin = THREE.MathUtils.degToRad(-88), latMax = THREE.MathUtils.degToRad(88);
    const ll = new Float32Array((NX + 1) * (NY + 1) * 2);
    let k = 0;
    for (let j = 0; j <= NY; j++) {
      const lat = latMax + (latMin - latMax) * (j / NY);
      for (let i = 0; i <= NX; i++) { ll[k++] = -Math.PI + (2 * Math.PI * i) / NX; ll[k++] = lat; }
    }
    const idx = new Uint32Array(NX * NY * 6);
    k = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("ll", new THREE.BufferAttribute(ll, 2));
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((NX + 1) * (NY + 1) * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;

    const vazio = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
    vazio.needsUpdate = true;

    const cores = amostrarCores(img);
    this.corCeu = cores.ceu;
    this.corChao = cores.chao;
    this.corMedia = cores.media;

    this.matDiorama = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        map: { value: tex },
        depthMap: { value: vazio },
        temProfundidade: { value: 0 },
        campo: { value: campo },
        faixaV: { value: this.faixaV },
        horizonte: { value: amb.horizonte },
        perto: { value: amb.perto },
        longe: { value: amb.longe },
        olho: { value: amb.olho },
        corNevoa: { value: cores.ceu.clone() },
        revelar: { value: 1 },
      },
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    this._stencil(this.matDiorama, true);
    this.diorama = new THREE.Mesh(geo, this.matDiorama);
    this.diorama.renderOrder = 2;
    this.diorama.frustumCulled = false;
    this.mundo = new THREE.Group();
    this.mundo.add(this.diorama);
    this.scene.add(this.mundo);
  }

  _criarPoeira() {
    const N = 320, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 1.5 + Math.random() * 10, a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = -1.2 + Math.random() * 3.2; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xffd99a, size: 0.014, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    this._stencil(m, true);
    this.poeira = new THREE.Points(g, m);
    this.poeira.renderOrder = 3;
    this.mundo.add(this.poeira);
  }

  _criarMoldura(img) {
    const W = 1.15, H = W * (img.naturalHeight / img.naturalWidth), B = 0.1, P = 0.07;
    const g = (this.moldura = new THREE.Group());
    // reflexo de uma sala neutra para o dourado brilhar como metal
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const ouro = new THREE.MeshStandardMaterial({ color: 0xe0b862, metalness: 1, roughness: 0.34, envMap: ambiente, envMapIntensity: 0.9 });
    const barra = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, P), ouro); m.position.set(x, y, 0); g.add(m); };
    barra(W + 2 * B, B, 0, H / 2 + B / 2);
    barra(W + 2 * B, B, 0, -H / 2 - B / 2);
    barra(B, H, -W / 2 - B / 2, 0);
    barra(B, H, W / 2 + B / 2, 0);
    // friso interno
    const friso = new THREE.MeshStandardMaterial({ color: 0x8a6526, metalness: 1, roughness: 0.45, envMap: ambiente, envMapIntensity: 0.8 });
    const fr = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, P * 1.3), friso); m.position.set(x, y, -0.005); g.add(m); };
    const f = 0.018;
    fr(W + f * 2, f, 0, H / 2 + f / 2); fr(W + f * 2, f, 0, -H / 2 - f / 2); fr(f, H, -W / 2 - f / 2, 0); fr(f, H, W / 2 + f / 2, 0);

    // a "janela": escreve no stencil, não desenha cor
    const janela = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp })
    );
    janela.renderOrder = 1;
    g.add(janela);
    this.janela = janela;
    this.janelaW = W;
    this.janelaH = H;
    this.camPortal = new THREE.PerspectiveCamera();
    this.molduraLarg = W + 2 * B;
    this.molduraAlt = H + 2 * B;
    this._posicionarMoldura();

    this.luzes = new THREE.Group();
    this.luzes.add(new THREE.HemisphereLight(0xfff3dc, 0x2a1a10, 1.4));
    const d = new THREE.DirectionalLight(0xffffff, 2.2);
    d.position.set(1.5, 2.5, 2);
    this.luzes.add(d);
    this.scene.add(this.luzes);
    g.visible = false;
    this.scene.add(g);
  }

  // afasta a moldura até ela caber na tela (celular em pé tem pouco campo horizontal)
  _posicionarMoldura() {
    if (!this.moldura) return;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const pelaLargura = this.molduraLarg / 0.86 / (2 * Math.tan(hfov / 2));
    const pelaAltura = this.molduraAlt / 0.6 / (2 * Math.tan(vfov / 2));
    this.molduraDist = Math.max(1.3, pelaLargura, pelaAltura);
    if (this.fase !== "travessia") this.moldura.position.set(0, -0.04 * this.molduraDist, -this.molduraDist);
  }

  _criarPessoa() {
    this.recorteCanvas = null;
    this.texPessoa = null;
    this.matPessoa = new THREE.ShaderMaterial({
      vertexShader: VERT_PESSOA,
      fragmentShader: FRAG_PESSOA,
      uniforms: { map: { value: null }, tom: { value: this.corMedia.clone() }, pintura: { value: 1 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.pessoa = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.matPessoa);
    this.pessoa.renderOrder = 10;
    this.pessoa.visible = false;
    this.pessoa.position.set(0, 0, -1);
    this.camera.add(this.pessoa);
  }

  _stencil(mat, ligado) {
    mat.stencilWrite = ligado;
    mat.stencilRef = 1;
    mat.stencilFunc = THREE.EqualStencilFunc;
    mat.stencilFail = THREE.KeepStencilOp;
    mat.stencilZFail = THREE.KeepStencilOp;
    mat.stencilZPass = THREE.KeepStencilOp;
    mat.needsUpdate = true;
  }

  // ---------------- API usada pela página ----------------
  definirProfundidade({ dados, largura, altura }) {
    const t = new THREE.DataTexture(dados, largura, altura, THREE.RedFormat, THREE.UnsignedByteType);
    t.unpackAlignment = 1;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    this.profundidade = { dados, largura, altura };
    this.matDiorama.uniforms.depthMap.value = t;
    this.matDiorama.uniforms.temProfundidade.value = 1;
  }

  // posição 3D de um ponto (u, v) da tela, para os pontos de interesse
  pontoNaCena(u, v) {
    const a = this.amb;
    const lon = (u - 0.5) * THREE.MathUtils.degToRad(a.campo);
    const lat = (a.horizonte - v) * this.faixaV;
    let d;
    if (this.profundidade) {
      const { dados, largura, altura } = this.profundidade;
      d = dados[Math.min(altura - 1, Math.round(v * (altura - 1))) * largura + Math.min(largura - 1, Math.round(u * (largura - 1)))] / 255;
    } else {
      d = THREE.MathUtils.smoothstep(v, a.horizonte - 0.02, 1.05);
    }
    const r = THREE.MathUtils.lerp(a.longe, a.perto, Math.pow(d, 1.5)) * 0.97;
    return new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), -Math.cos(lat) * Math.cos(lon)).multiplyScalar(r);
  }

  abrirPortal(comCamera) {
    this.fase = "portal";
    this.orientacao.realinhar();
    this.moldura.visible = true;
    this.camera.position.set(0, 0, 0);
    this.mundo.position.set(0, 0, 0);
    this.renderer.setClearColor(0x000000, 0); // transparente: aparece a câmera (ou a parede do museu) atrás
    this._stencil(this.matDiorama, true);
    this._stencil(this.poeira.material, true);
  }

  atravessar() {
    if (this.fase !== "portal") return;
    this.fase = "travessia";
    this.travessia = { t0: this.relogio.getElapsed(), dur: 1.8 };
  }

  entrarDireto() {
    this.fase = "dentro";
    this.orientacao.realinhar();
    this.moldura.visible = false;
    this._stencil(this.matDiorama, false);
    this._stencil(this.poeira.material, false);
    this.renderer.setClearColor(this.corCeu, 1);
    this.camera.position.set(0, 0, 0);
    this.mundo.position.set(0, 0, 0);
  }

  definirModo(modo, recorte) {
    this.modo = modo;
    if (modo === "selfie" && recorte) {
      this.recorte = recorte;
      if (!this.texPessoa || this.texPessoa.image !== recorte.canvas) {
        this.texPessoa?.dispose();
        this.texPessoa = new THREE.CanvasTexture(recorte.canvas);
        this.texPessoa.colorSpace = THREE.SRGBColorSpace;
        this.matPessoa.uniforms.map.value = this.texPessoa;
      }
      this.pessoa.visible = true;
      this._ajustarPessoa();
    } else {
      this.pessoa.visible = false;
      this.recorte = null;
    }
  }

  _ajustarPessoa() {
    const v = this.recorte?.video;
    if (!v || !v.videoWidth) return;
    const D = 1, alt = 2 * D * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), larg = alt * this.camera.aspect;
    const av = v.videoWidth / v.videoHeight;
    let w, h;
    if (av > this.camera.aspect) { h = alt; w = alt * av; } else { w = larg; h = larg / av; }
    this.pessoa.scale.set(w, h, 1);
    this._pessoaAspecto = av;
  }

  async fotografar() {
    // o quadro já está no buffer (preserveDrawingBuffer); renderiza uma vez para garantir
    this.renderer.render(this.scene, this.camera);
    return new Promise((ok) => this.canvas.toBlob(ok, "image/jpeg", 0.93));
  }

  // ---------------- loop ----------------
  _loop() {
    this.relogio.update();
    const t = this.relogio.getElapsed();
    const cam = this.camera;
    this.orientacao.atualizar(cam, this.modo === "selfie" && this.fase === "dentro");

    if (this.fase === "travessia") {
      const p = Math.min(1, (t - this.travessia.t0) / this.travessia.dur);
      const e = easeInOut(p);
      const alvo = this.molduraDist + 0.6;
      const frente = new THREE.Vector3(0, -0.05, -1).normalize();
      cam.position.copy(frente).multiplyScalar(alvo * e);
      // o mundo acompanha na segunda metade, para você terminar no centro da cena
      this.mundo.position.copy(frente).multiplyScalar(alvo * THREE.MathUtils.smoothstep(e, 0.45, 1));
      cam.fov = 72 + Math.sin(p * Math.PI) * 14;
      cam.updateProjectionMatrix();
      const passou = alvo * e > this.molduraDist + 0.02;
      if (passou && this.moldura.visible) {
        this.moldura.visible = false;
        this._stencil(this.matDiorama, false);
        this._stencil(this.poeira.material, false);
        this.renderer.setClearColor(this.corCeu, 1);
        this.aoPassar?.();
      }
      if (p >= 1) {
        this.fase = "dentro";
        cam.position.set(0, 0, 0);
        this.mundo.position.set(0, 0, 0);
        cam.fov = 72;
        cam.updateProjectionMatrix();
        this.aoEntrar?.();
      }
    }

    // poeira flutuando
    this.poeira.rotation.y = t * 0.012;
    this.poeira.position.y = Math.sin(t * 0.3) * 0.05;

    if (this.modo === "selfie" && this.recorte && this.recorte.atualizar()) {
      this.texPessoa.needsUpdate = true;
      if (this._pessoaAspecto !== this.recorte.video.videoWidth / this.recorte.video.videoHeight) this._ajustarPessoa();
    }

    if ((this.fase === "portal" || this.fase === "travessia") && this.moldura.visible) this._renderPortal();
    else this.renderer.render(this.scene, cam);
    this.aoQuadro?.(this);
  }

  /*
    Portal: 1º passe desenha a moldura e marca a janela no stencil (câmera real).
    2º passe desenha a cena com uma câmera cuja projeção encaixa a pintura inteira dentro da janela,
    então pela moldura você vê a composição completa, como no museu. Ao se aproximar, a janela cresce
    e a pintura vira o mundo ao seu redor.
  */
  _renderPortal() {
    const r = this.renderer, cam = this.camera, amb = this.amb;
    cam.updateMatrixWorld();
    this.moldura.updateMatrixWorld(true);
    const hw = this.janelaW / 2, hh = this.janelaH / 2;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, ok = true;
    const v = new THREE.Vector3();
    for (const [x, y] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
      v.set(x, y, 0).applyMatrix4(this.janela.matrixWorld);
      const local = v.clone().applyMatrix4(cam.matrixWorldInverse);
      if (local.z > -cam.near * 2) { ok = false; break; }
      v.project(cam);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }

    this.mundo.visible = false;
    r.render(this.scene, cam);
    this.mundo.visible = true;
    if (!ok || x1 - x0 < 1e-3 || y1 - y0 < 1e-3) return;

    // tangentes das bordas da pintura vistas do centro da cena
    const meio = THREE.MathUtils.degToRad(amb.campo) / 2;
    const tx0 = -Math.tan(meio), tx1 = Math.tan(meio);
    const ty1 = Math.tan(amb.horizonte * this.faixaV), ty0 = Math.tan(-(1 - amb.horizonte) * this.faixaV);
    const ax = (tx1 - tx0) / (x1 - x0), bx = tx0 - ax * x0;
    const ay = (ty1 - ty0) / (y1 - y0), by = ty0 - ay * y0;
    const n = 0.05, f = 400;
    const pc = this.camPortal;
    pc.projectionMatrix.makePerspective((bx - ax) * n, (bx + ax) * n, (by + ay) * n, (by - ay) * n, n, f);
    pc.projectionMatrixInverse.copy(pc.projectionMatrix).invert();
    pc.position.copy(this.mundo.position);
    pc.quaternion.identity();
    pc.updateMatrixWorld();

    this.moldura.visible = false;
    r.autoClear = false;
    r.clearDepth();
    r.render(this.scene, pc);
    r.autoClear = true;
    this.moldura.visible = true;
  }

  // projeta pontos 3D (coordenadas do mundo) para a tela; null se estiver atrás
  projetar(v3) {
    const p = v3.clone().add(this.mundo.position).project(this.camera);
    if (p.z > 1 || p.z < -1) return null;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
  }

  destruir() {
    this.renderer.setAnimationLoop(null);
    this._ro.disconnect();
    this.orientacao.destruir();
    this.scene.traverse((o) => { o.geometry?.dispose(); });
    this.renderer.dispose();
  }
}

// Cores médias do topo (céu), da base (chão) e da tela toda — usadas para névoa e para tingir a selfie.
function amostrarCores(img) {
  const w = 64, h = Math.max(8, Math.round((64 * img.naturalHeight) / img.naturalWidth));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const media = (y0, y1) => {
    const d = ctx.getImageData(0, y0, w, Math.max(1, y1 - y0)).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  };
  return { ceu: media(0, Math.round(h * 0.12)), chao: media(Math.round(h * 0.88), h), media: media(0, h) };
}
