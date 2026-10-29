// Carrega a primeira imagem que responder, na ordem do acervo (arquivo local primeiro, Wikimedia depois).
const resolver = (src) => new URL(src, document.baseURI).href;

export async function carregarImagem(fontes) {
  for (const src of fontes) {
    try {
      const r = await fetch(resolver(src), { mode: "cors" });
      if (!r.ok) continue;
      const blob = await r.blob();
      if (!blob.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(blob);
      const img = await new Promise((ok, erro) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = erro;
        i.src = url;
      });
      return { blob, img, url, fonte: src };
    } catch {
      /* tenta a próxima */
    }
  }
  throw new Error("Não foi possível carregar a imagem da obra.");
}

const cache = new Map();
export function obterImagem(fontes) {
  const k = fontes.join("|");
  if (!cache.has(k)) {
    const p = carregarImagem(fontes);
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return cache.get(k);
}
export const primeiraImagemDisponivel = (fontes) => obterImagem(fontes).then((r) => r.url);
