/*
  Gera docs/diagrams/*.png a partir das fontes Mermaid docs/diagrams/*.mmd, no Chrome headless.
  Uso: npm run diagramas      (precisa de internet para carregar o Mermaid do jsDelivr)
*/
if (!globalThis.WebSocket) { console.error("Precisa do Node 22 ou mais novo (WebSocket nativo)."); process.exit(1); }
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path"; import { tmpdir } from "node:os";
const DIA = new URL("../docs/diagrams/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const perfil = join(tmpdir(), "culturar-dia-" + Date.now());
const ch = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=9334", `--user-data-dir=${perfil}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let url; for (let i = 0; i < 50 && !url; i++) { try { url = (await (await fetch("http://127.0.0.1:9334/json/list")).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {} await espera(200); }
const ws = new WebSocket(url); await new Promise((r) => ws.addEventListener("open", r));
let seq = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((ok, erro) => { const id = ++seq; pend.set(id, (m) => m.error ? erro(new Error(m.error.message)) : ok(m.result)); ws.send(JSON.stringify({ id, method, params })); });
const js = async (e) => { const r = await cdp("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
await cdp("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 2, mobile: false });
await js(`document.body.style.margin = 0; document.body.style.background = "#fff"; new Promise((ok, erro) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"; s.onload = ok; s.onerror = erro; document.head.append(s); })`);
await js(`mermaid.initialize({ startOnLoad: false, theme: "base", fontFamily: "Arial, sans-serif", flowchart: { htmlLabels: false, curve: "basis" }, themeVariables: { primaryColor: "#f1e8d9", primaryBorderColor: "#8a6d35", primaryTextColor: "#2a2019", lineColor: "#8a6d35", secondaryColor: "#fbf6ee", tertiaryColor: "#fffdf9", clusterBkg: "#fbf6ee", clusterBorder: "#c9a356", fontSize: "16px", actorBkg: "#f1e8d9", actorBorder: "#8a6d35", noteBkgColor: "#fbf6ee" } }); true`);
for (const f of readdirSync(DIA).filter((x) => x.endsWith(".mmd"))) {
  const code = readFileSync(join(DIA, f), "utf8");
  const svg = await js(`mermaid.render("d${Math.random().toString(36).slice(2)}", ${JSON.stringify(code)}).then(r => r.svg)`);
  const comFundo = svg.replace(/<svg ([^>]*?)style="/, '<svg $1style="background:#ffffff;');
  const box = await js(`(() => { document.body.innerHTML = '<div id="w" style="display:inline-block;padding:24px;background:#fff">' + ${JSON.stringify(comFundo)} + '</div>'; const s = document.querySelector("#w svg"); const vb = s.viewBox.baseVal; s.removeAttribute("width"); s.style.maxWidth = "none"; s.style.width = vb.width + "px"; s.style.height = vb.height + "px"; const r = document.getElementById("w").getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height) }; })()`);
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: box.w, height: box.h, scale: 1 } });
  writeFileSync(join(DIA, f.replace(".mmd", ".png")), Buffer.from(shot.data, "base64"));
  console.log(f, box);
}
ws.close(); ch.kill(); await espera(400); try { rmSync(perfil, { recursive: true, force: true }); } catch {}
