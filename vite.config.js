import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// base "./" deixa o build funcionar em qualquer subpasta (GitHub Pages, Netlify, Vercel).
// `npm run celular` sobe com HTTPS na rede local: câmera e giroscópio só funcionam em HTTPS.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "celular" ? [basicSsl()] : [])],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  build: { target: "es2022", chunkSizeWarningLimit: 4000 },
}));
