/*
  Teste ponta a ponta do CulturAR no Chrome headless (DevTools Protocol, sem dependências).

  Uso:   npm run dev            (em outro terminal)
         npm run teste:e2e      ou  node scripts/teste-e2e.mjs [url]

  O que faz: percorre o fluxo do visitante em tela de celular com câmera simulada, registra cada passo
  como PASSOU/FALHOU, salva as screenshots em docs/images/, regera o mapa de profundidade em
  public/obras/ pelo #/painel e grava o relatório em docs/documents/resultado-teste-e2e.json.
  Chrome: caminho em CHROME_PATH ou o padrão do Windows.
*/
if (!globalThis.WebSocket) { console.error("Precisa do Node 22 ou mais novo (WebSocket nativo)."); process.exit(1); }
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = process.argv[2] || "http://localhost:5173";
const PROJ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const IMG = join(PROJ, "docs/images");
mkdirSync(IMG, { recursive: true });
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const perfil = join(tmpdir(), "culturar-cdp-" + Date.now());
const porta = 9333;
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
  "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run", "--hide-scrollbars",
  "--window-size=1280,900", "about:blank",
], { stdio: "ignore" });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const testes = [];
const registrar = (id, ok, obs) => { testes.push({ id, ok, obs }); console.log(ok ? "PASSOU" : "FALHOU", id, obs ?? ""); };

async function alvo() {
  for (let i = 0; i < 50; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      const p = l.find((t) => t.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await espera(200);
  }
  throw new Error("Chrome não respondeu");
}

const ws = new WebSocket(await alvo());
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0; const pend = new Map(); const logs = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const { ok, erro } = pend.get(m.id); pend.delete(m.id); m.error ? erro(new Error(m.error.message)) : ok(m.result); }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  if (m.method === "Runtime.exceptionThrown") logs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});
const cdp = (method, params = {}) => new Promise((ok, erro) => { const id = ++seq; pend.set(id, { ok, erro }); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr, awaitPromise = true) => {
  const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
async function ate(expr, ms = 30000, passo = 250) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { try { if (await js(expr)) return true; } catch {} await espera(passo); }
  return false;
}
async function foto(nome, { qualidade = 82, cheia = false } = {}) {
  const r = await cdp("Page.captureScreenshot", { format: "jpeg", quality: qualidade, captureBeyondViewport: cheia });
  writeFileSync(join(IMG, nome), Buffer.from(r.data, "base64"));
  console.log("  screenshot", nome);
}
const clicar = (sel) => js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel.css)})].find(x => ${sel.texto ? `x.textContent.includes(${JSON.stringify(sel.texto)})` : "true"}); if (!e) return false; e.click(); return true; })()`);
async function ir(hash) { await js(`location.hash = ${JSON.stringify(hash)}; true`); await espera(400); }
async function celular() { await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await cdp("Emulation.setTouchEmulationEnabled", { enabled: true }); }
async function desktop() { await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }); await cdp("Emulation.setTouchEmulationEnabled", { enabled: false }); }

await cdp("Page.enable"); await cdp("Runtime.enable");
const versao = (await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json()).Browser;
console.log("Navegador:", versao);

// ---------- 1. Build carrega ----------
await desktop();
await cdp("Page.navigate", { url: BASE + "/#/" });
registrar("carrega-app", await ate(`!!document.querySelector(".home h1")`, 20000), "Acervo renderiza");

// ---------- 2. Mapa de profundidade pelo painel ----------
await ir("/painel");
registrar("painel-placa", await ate(`!!document.querySelector(".placa img[src^='data:image/png']")`, 10000), "Placa com QR gerada");
const urlPlaca = await js(`document.querySelector(".placa .url")?.textContent`);
registrar("painel-url-qr", /#\/obra\/independencia-ou-morte$/.test(urlPlaca || ""), urlPlaca);
await foto("painel-placas.jpg");
const t0 = Date.now();
await clicar({ css: ".ferramenta button", texto: "Gerar mapa" });
const gerou = await ate(`[...document.querySelectorAll(".ferramenta p")].some(p => p.textContent.startsWith("Pronto") || p.textContent.startsWith("Falhou"))`, 240000, 1000);
const estado = await js(`[...document.querySelectorAll(".ferramenta p")].map(p => p.textContent).pop()`);
const okProf = gerou && estado.startsWith("Pronto");
registrar("ia-profundidade", okProf, `${estado} (${Math.round((Date.now() - t0) / 1000)} s, incluindo download do modelo)`);
if (okProf) {
  const b64 = await js(`(async () => { const a = document.querySelector(".ferramenta a[download]"); const b = await (await fetch(a.href)).arrayBuffer(); let s = ""; const u = new Uint8Array(b); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); })()`);
  writeFileSync(join(PROJ, "public/obras/independencia-ou-morte-profundidade.png"), Buffer.from(b64, "base64"));
  await js(`window.scrollTo(0, document.querySelector(".ferramenta").offsetTop - 20); true`);
  await espera(300);
  await foto("painel-profundidade.jpg");
}

// ---------- 3. Experiência no celular ----------
await celular();
await js(`localStorage.clear(); indexedDB.deleteDatabase("culturar"); true`);
await cdp("Page.navigate", { url: BASE + "/#/" });
await ate(`!!document.querySelector(".home h1")`);
await ate(`!!document.querySelector(".cartao-obra .tela[style*='background-image']")`, 15000);
await espera(500);
await foto("tela-acervo.jpg");

await ir("/obra/independencia-ou-morte");
const pronto = await ate(`[...document.querySelectorAll(".entrada .btn.ouro")].some(b => !b.disabled && b.textContent.includes("Entrar"))`, 30000);
registrar("obra-carrega", pronto, "Botão “Entrar no quadro” ativo");
await espera(600);
await foto("tela-entrada.jpg");

await clicar({ css: ".entrada .btn.ouro", texto: "Entrar" });
const portal = await ate(`!!document.querySelector(".instrucao")`, 15000);
const comCamera = await js(`!document.querySelector("video.fundo").hidden`);
registrar("portal-abre", portal, "Moldura aparece");
registrar("camera-traseira", comCamera, "Vídeo da câmera atrás do portal (câmera simulada)");
await ate(`document.querySelector(".barra-topo .chip.status")?.textContent.includes("3D")`, 30000);
const statusProf = await js(`document.querySelector(".barra-topo .chip.status")?.textContent`);
registrar("profundidade-carrega", /3D/.test(statusProf || ""), statusProf);
await espera(1200);
await foto("tela-portal.jpg");

await clicar({ css: ".barra-base .btn.ouro", texto: "Atravessar" });
const dentro = await ate(`!!document.querySelector(".obturador")`, 15000);
registrar("travessia", dentro, "Entra na cena após a animação");
await espera(1500);
const pontosVisiveis = await js(`[...document.querySelectorAll(".ponto")].filter(p => !p.hidden).length`);
registrar("pontos-visiveis", pontosVisiveis > 0, `${pontosVisiveis} de 4 pontos visíveis olhando para a frente`);
await foto("tela-cena.jpg");

// olhar em volta arrastando (sem giroscópio no headless)
const arrastar = async (dx) => {
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: 195, y: 420, button: "left", clickCount: 1 });
  for (let i = 1; i <= 10; i++) await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: 195 + (dx * i) / 10, y: 420, button: "left" });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: 195 + dx, y: 420, button: "left" });
};
const antes = await js(`[...document.querySelectorAll(".ponto")].map(p => p.style.transform).join("|")`);
await arrastar(-160); await espera(500);
const depois = await js(`[...document.querySelectorAll(".ponto")].map(p => p.style.transform).join("|")`);
registrar("olhar-em-volta", antes !== depois, "Arrastar gira a vista (modo sem giroscópio)");
await foto("tela-cena-girada.jpg");
await arrastar(160); await espera(500);

const abriu = await js(`(() => { const p = [...document.querySelectorAll(".ponto")].find(p => !p.hidden); if (!p) return false; p.click(); return true; })()`);
await espera(400);
const folha = await js(`document.querySelector(".folha .t")?.textContent`);
registrar("ponto-de-interesse", abriu && !!folha, folha);
await foto("tela-ponto.jpg");
await clicar({ css: ".folha .fechar" });

await clicar({ css: ".barra-topo .chip.icone[aria-label='Sobre a obra']" });
await espera(300);
registrar("sobre-a-obra", (await js(`document.querySelector(".folha .t")?.textContent`)) === "Independência ou Morte!", "Painel “Sobre a obra”");
await clicar({ css: ".folha .fechar" });

await clicar({ css: ".vidro-grupo .btn", texto: "Selfie" });
const selfie = await ate(`document.querySelector(".vidro-grupo .btn[aria-pressed='true']")?.textContent.includes("Selfie")`, 60000, 500);
registrar("selfie-liga", selfie, "Câmera frontal + MediaPipe carregados (câmera simulada, sem pessoa real)");
await clicar({ css: ".vidro-grupo .btn", texto: "Olhar" });
await espera(800);

await clicar({ css: ".obturador" });
const fotoOk = await ate(`!!document.querySelector(".foto-preview img")?.complete`, 15000);
const dims = fotoOk ? await js(`(() => { const i = document.querySelector(".foto-preview img"); return i.naturalWidth + "×" + i.naturalHeight; })()`) : "";
registrar("foto-etiqueta", fotoOk, `Foto composta com etiqueta (${dims})`);
await espera(400);
await foto("tela-foto.jpg");
if (fotoOk) {
  const b64 = await js(`(async () => { const b = await (await fetch(document.querySelector(".foto-preview img").src)).arrayBuffer(); let s = ""; const u = new Uint8Array(b); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); })()`);
  writeFileSync(join(IMG, "foto-gerada.jpg"), Buffer.from(b64, "base64"));
}

// ---------- 4. Leitor de QR e QR inválido ----------
await ir("/escanear");
const leitor = await ate(`document.querySelector(".scanner video")?.readyState >= 2`, 10000);
registrar("leitor-qr-camera", leitor, "Leitor abre a câmera");
await espera(800);
await foto("tela-leitor-qr.jpg");
await ir("/obra/nao-existe");
registrar("qr-obra-inexistente", (await js(`document.querySelector(".aviso")?.textContent || ""`)).includes("não está no acervo"), "Aviso para obra fora do acervo");

// ---------- 5. Roteiro de validação ----------
await ir("/validacao");
await ate(`!!document.querySelector(".validacao h1")`);
await espera(500);
const anot = await js(`document.querySelectorAll(".v-anotacoes > div").length`);
const sugeridos = await js(`document.querySelectorAll(".v-auto").length`);
registrar("validacao-diagnostico", anot > 0 && sugeridos > 0, `${anot} anotações automáticas, ${sugeridos} passos pré-marcados`);
await foto("tela-validacao.jpg");

writeFileSync(join(PROJ, "docs/documents/resultado-teste-e2e.json"), JSON.stringify({ data: new Date().toISOString(), navegador: versao, url: BASE, testes, errosNoConsole: logs }, null, 1));
console.log(`
${testes.filter((t) => t.ok).length}/${testes.length} passos passaram`);
console.log("\nErros no console:", logs.length ? logs.slice(0, 8) : "nenhum");
ws.close(); chrome.kill();
await espera(500);
try { rmSync(perfil, { recursive: true, force: true }); } catch {}
process.exit(testes.every((t) => t.ok) ? 0 : 1);
