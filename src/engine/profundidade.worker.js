// Estima a profundidade da pintura com Depth Anything V2 (roda no aparelho, via WebAssembly).
import { pipeline, env, RawImage } from "@huggingface/transformers";

env.allowLocalModels = false;
let estimador = null;

self.onmessage = async (e) => {
  try {
    if (!estimador) {
      estimador = await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p) => {
          if (p.status === "progress" && p.file?.endsWith(".onnx")) {
            self.postMessage({ tipo: "progresso", etapa: "baixando", pct: Math.round(p.progress || 0) });
          }
        },
      });
    }
    self.postMessage({ tipo: "progresso", etapa: "calculando" });
    const img = await RawImage.fromBlob(e.data.blob);
    const saida = await estimador(img);
    const d = saida.depth;
    const dados = new Uint8Array(d.data); // cópia própria para transferir
    self.postMessage({ tipo: "pronto", dados, largura: d.width, altura: d.height }, [dados.buffer]);
  } catch (err) {
    self.postMessage({ tipo: "erro", msg: String(err?.message || err) });
  }
};
