/*
  Roteiro de validação (#/validacao).

  Durante a experiência, o app anota o que consegue detectar sozinho (registrar): câmera, movimento,
  profundidade, selfie, foto. O formulário usa essas anotações para sugerir o resultado de cada passo;
  o testador confirma ou corrige. Tudo fica no próprio aparelho (localStorage) e sai em CSV.
*/

const CHAVE_DIAG = "culturar-diagnostico";
const CHAVE_TESTES = "culturar-testes";
const CHAVE_RASCUNHO = "culturar-validacao-rascunho";

const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };

// ---------- diagnóstico automático ----------
export function registrar(chave, valor) {
  const d = ler(CHAVE_DIAG, {});
  d[chave] = { valor, em: Date.now() };
  gravar(CHAVE_DIAG, d);
}
export const lerDiagnostico = () => ler(CHAVE_DIAG, {});
export const limparDiagnostico = () => gravar(CHAVE_DIAG, {});

// Enquanto um teste está em andamento, a experiência mostra o atalho "Roteiro" para voltar ao formulário.
const CHAVE_MODO = "culturar-validando";
export const iniciarValidacao = () => gravar(CHAVE_MODO, true);
export const encerrarValidacao = () => { try { localStorage.removeItem(CHAVE_MODO); } catch { /* sem storage */ } };
export const emValidacao = () => ler(CHAVE_MODO, false) === true;

export function detectarAparelho() {
  const ua = navigator.userAgent;
  const sistema = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iOS"
    : /Android/.test(ua) ? "Android" : "Computador";
  const navegador = /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /Chrome|CriOS/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari" : "Outro";
  const versaoIOS = ua.match(/OS (\d+)[_.](\d+)/);
  return {
    sistema,
    navegador,
    versao: sistema === "iOS" && versaoIOS ? `iOS ${versaoIOS[1]}.${versaoIOS[2]}` : "",
    endereco: location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "localhost"
      : /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(location.hostname) ? "rede-local" : "publicado",
    https: isSecureContext,
    camera: !!navigator.mediaDevices?.getUserMedia,
    giroscopio: "DeviceOrientationEvent" in window,
    offscreen: typeof OffscreenCanvas !== "undefined",
    barcode: "BarcodeDetector" in window,
    tela: `${screen.width}×${screen.height} @${devicePixelRatio}x`,
    ua,
  };
}

// ---------- roteiro ----------
// auto(d) → sugestão de resultado a partir do diagnóstico ("ok" | "parcial" | "falha" | undefined)
const v = (d, k) => d[k]?.valor;

export const ETAPAS = [
  { id: "qr", titulo: "Acesso pelo QR code", desc: "Placa impressa em #/painel, ao lado da obra.", itens: [
    { id: "qr-nativo", t: "A câmera nativa do celular lê a placa e abre a obra", d: "Deve abrir direto em #/obra/independencia-ou-morte." },
    { id: "qr-interno", t: "O leitor do app (Escanear QR code) reconhece a placa",
      auto: (d) => v(d, "qr-interno") === "ok" ? "ok" : v(d, "qr-interno") === "sem-camera" ? "falha" : undefined },
    { id: "qr-estranho", t: "Um QR de outro site mostra “Esse QR code não é de uma obra do CulturAR”",
      auto: (d) => v(d, "qr-estranho") ? "ok" : undefined },
  ]},
  { id: "entrada", titulo: "Entrada", desc: "O cartão com a etiqueta da obra.", itens: [
    { id: "ent-imagem", t: "A pintura e a etiqueta aparecem (título, artista, ano, acervo)",
      auto: (d) => v(d, "imagem") === "erro" ? "falha" : v(d, "imagem") ? "ok" : undefined },
    { id: "ent-permissoes", t: "Ao tocar em “Entrar no quadro”, o celular pede câmera e movimento", d: "No iPhone, o pedido de movimento é separado.",
      auto: (d) => v(d, "camera-traseira") === undefined ? undefined
        : v(d, "camera-traseira") === "ok" && v(d, "movimento") === "ok" ? "ok" : "parcial" },
  ]},
  { id: "portal", titulo: "Portal", desc: "A moldura dourada flutuando no ambiente real.", itens: [
    { id: "por-camera", t: "A câmera traseira abre e a moldura aparece sobre o ambiente",
      auto: (d) => v(d, "camera-traseira") === "ok" ? "ok" : v(d, "camera-traseira") === "negada" ? "falha" : undefined },
    { id: "por-atravessar", t: "Tocar na moldura ou em “Atravessar” faz a travessia",
      auto: (d) => v(d, "travessia") === "atravessou" ? "ok" : undefined },
    { id: "por-pular", t: "“Pular” leva direto para dentro da cena",
      auto: (d) => v(d, "travessia") === "pulou" ? "ok" : undefined },
    { id: "por-3d", t: "O indicador termina em “Cena em 3D”", d: "Parcial se terminar em “modo simples (sem IA de profundidade)”.",
      auto: (d) => v(d, "profundidade") === "falhou" ? "parcial" : v(d, "profundidade") ? "ok" : undefined },
  ]},
  { id: "dentro", titulo: "Dentro da cena", desc: "A pintura vira um lugar 360° ao seu redor.", itens: [
    { id: "den-frente", t: "Ao entrar, a obra está à sua frente" },
    { id: "den-girar", t: "Girar o celular move a vista no sentido certo, sem tremer",
      auto: (d) => v(d, "movimento") === "negado" ? "falha" : undefined },
    { id: "den-prof", t: "Dá para sentir a profundidade (cavaleiros perto, fundo longe)" },
    { id: "den-pontos", t: "Os 4 pontos dourados ficam sobre D. Pedro I, a Guarda de Honra, o carreiro e a casa" },
    { id: "den-folha", t: "Tocar num ponto abre o texto; o ícone ⓘ abre “Sobre a obra”",
      auto: (d) => v(d, "ponto-aberto") ? "ok" : undefined },
    { id: "den-fluidez", t: "A cena roda sem engasgos nem aquecimento excessivo" },
  ]},
  { id: "selfie", titulo: "Selfie na cena", desc: "Câmera frontal com você recortado dentro da pintura.", itens: [
    { id: "sel-liga", t: "Tocar em “Selfie” liga a câmera frontal",
      auto: (d) => v(d, "selfie") === "ok" ? "ok" : v(d, "selfie") === "falhou" ? "falha" : undefined },
    { id: "sel-recorte", t: "O recorte separa você do fundo sem bordas grosseiras" },
    { id: "sel-fundo", t: "Girar o celular muda o cenário atrás de você" },
  ]},
  { id: "foto", titulo: "Foto", desc: "O botão redondo na base da tela.", itens: [
    { id: "fot-etiqueta", t: "A foto sai com a etiqueta do museu embaixo (título, artista, CULTURAR)",
      auto: (d) => v(d, "foto") ? "ok" : undefined },
    { id: "fot-espelho", t: "Na selfie, o texto da etiqueta está legível (não espelhado)" },
    { id: "fot-compartilhar", t: "“Compartilhar” abre o menu do celular",
      auto: (d) => v(d, "compartilhar") === "menu" ? "ok" : v(d, "compartilhar") === "baixou" ? "parcial" : undefined },
    { id: "fot-salvar", t: "“Salvar” guarda a imagem no aparelho" },
  ]},
];
export const TODOS_ITENS = ETAPAS.flatMap((e) => e.itens.map((i) => ({ ...i, etapa: e.titulo })));

export const ESCALAS = [
  { id: "facilidade", t: "Facilidade de uso" },
  { id: "imersao", t: "Sensação de estar dentro do quadro" },
  { id: "velocidade", t: "Velocidade" },
  { id: "recomendaria", t: "Recomendaria a um amigo" },
];
export const RESULTADOS = [["ok", "Passou"], ["parcial", "Parcial"], ["falha", "Falhou"], ["na", "Não testei"]];
export const VEREDITOS = [
  ["aprovado", "Aprovado", "Funciona do início ao fim"],
  ["ressalvas", "Com ressalvas", "Funciona, mas tem falhas a corrigir"],
  ["reprovado", "Reprovado", "Algo impede a experiência"],
];

// ---------- testes salvos no aparelho ----------
export const lerTestes = () => ler(CHAVE_TESTES, []);
export function salvarTeste(teste) {
  const todos = [{ ...teste, id: `t${Date.now().toString(36)}`, criadoEm: new Date().toISOString() }, ...lerTestes()];
  gravar(CHAVE_TESTES, todos);
  return todos;
}
export function apagarTeste(id) {
  const todos = lerTestes().filter((t) => t.id !== id);
  gravar(CHAVE_TESTES, todos);
  return todos;
}
export const lerRascunho = () => ler(CHAVE_RASCUNHO, null);
export const gravarRascunho = (r) => gravar(CHAVE_RASCUNHO, r);
export const limparRascunho = () => { try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem storage */ } };

export function paraCSV(testes) {
  const esc = (x) => { const s = x == null ? "" : String(x); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cab = ["criadoEm", "testador", "papel", "aparelho", "sistema", "navegador", "rede", "versao", "obra", "primeiraVisita", "tempoCarregar_s", "fonteProfundidade",
    ...TODOS_ITENS.flatMap((i) => [i.id, `${i.id}_nota`]), ...ESCALAS.map((s) => s.id), "veredito", "gostou", "problemas", "sugestoes", "userAgent"];
  const linhas = testes.map((t) => [t.criadoEm, t.testador, t.papel, t.aparelho, t.sistema, t.navegador, t.rede, t.endereco, t.obra,
    t.primeiraVisita ? "sim" : "nao", t.tempoCarregar, t.fonteProfundidade,
    ...TODOS_ITENS.flatMap((i) => [t.itens?.[i.id]?.r || "", t.itens?.[i.id]?.nota || ""]),
    ...ESCALAS.map((s) => t.notas?.[s.id] ?? ""), t.veredito, t.gostou, t.problemas, t.sugestoes, t.ua].map(esc).join(","));
  return [cab.join(","), ...linhas].join("\n");
}
