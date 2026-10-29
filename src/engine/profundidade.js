/*
  Mapa de profundidade da obra (cinza: claro = perto, escuro = longe).
  Ordem: 1) arquivo pré-calculado em public/obras  2) cache do aparelho  3) IA no aparelho.
*/
const VERSAO = 1;

// ---------- IndexedDB simples ----------
function abrir() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open("culturar", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("profundidade");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
async function lerCache(chave) {
  try {
    const db = await abrir();
    return await new Promise((ok) => {
      const q = db.transaction("profundidade").objectStore("profundidade").get(chave);
      q.onsuccess = () => ok(q.result || null);
      q.onerror = () => ok(null);
    });
  } catch { return null; }
}
async function gravarCache(chave, valor) {
  try {
    const db = await abrir();
    db.transaction("profundidade", "readwrite").objectStore("profundidade").put(valor, chave);
  } catch { /* sem cache, tudo bem */ }
}

// ---------- utilidades ----------
async function lerPNGcinza(url) {
  const r = await fetch(new URL(url, document.baseURI).href);
  if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) return null;
  const bmp = await createImageBitmap(await r.blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const rgba = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const dados = new Uint8Array(bmp.width * bmp.height);
  for (let i = 0; i < dados.length; i++) dados[i] = rgba[i * 4];
  return { dados, largura: bmp.width, altura: bmp.height };
}

async function reduzir(img, largura = 1024) {
  const w = Math.min(largura, img.naturalWidth);
  const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
  const c = new OffscreenCanvas(w, h);
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  return c.convertToBlob({ type: "image/jpeg", quality: 0.92 });
}

// Desfoque leve (caixa separável) para suavizar degraus da profundidade.
export function suavizar({ dados, largura: w, altura: h }, raio = 2) {
  const tmp = new Float32Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = -raio; k <= raio; k++) { const xx = Math.min(w - 1, Math.max(0, x + k)); s += dados[y * w + xx]; n++; }
    tmp[y * w + x] = s / n;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = -raio; k <= raio; k++) { const yy = Math.min(h - 1, Math.max(0, y + k)); s += tmp[yy * w + x]; n++; }
    out[y * w + x] = Math.round(s / n);
  }
  return { dados: out, largura: w, altura: h };
}

export function calcularComIA(img, aoProgredir) {
  return new Promise(async (ok, erro) => {
    const worker = new Worker(new URL("./profundidade.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.tipo === "progresso") aoProgredir?.(m);
      else if (m.tipo === "pronto") { worker.terminate(); ok({ dados: m.dados, largura: m.largura, altura: m.altura }); }
      else if (m.tipo === "erro") { worker.terminate(); erro(new Error(m.msg)); }
    };
    worker.onerror = (e) => { worker.terminate(); erro(e); };
    worker.postMessage({ blob: await reduzir(img) });
  });
}

export async function obterProfundidade(obra, img, aoProgredir) {
  if (obra.profundidade) {
    try {
      const p = await lerPNGcinza(obra.profundidade);
      if (p) return { ...suavizar(p, 1), fonte: "arquivo" };
    } catch { /* segue */ }
  }
  const chave = `${obra.id}@${VERSAO}`;
  const c = await lerCache(chave);
  if (c) return { ...c, fonte: "cache" };
  const bruto = await calcularComIA(img, aoProgredir);
  const p = suavizar(bruto, 2);
  gravarCache(chave, p);
  return { ...p, fonte: "ia" };
}

// Para o painel: gera o PNG que vai em public/obras/<id>-profundidade.png
export async function profundidadeParaPNG({ dados, largura, altura }) {
  const c = new OffscreenCanvas(largura, altura);
  const ctx = c.getContext("2d");
  const im = ctx.createImageData(largura, altura);
  for (let i = 0; i < dados.length; i++) { const v = dados[i]; im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  ctx.putImageData(im, 0, 0);
  return c.convertToBlob({ type: "image/png" });
}
