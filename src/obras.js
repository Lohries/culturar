/*
  Acervo do CulturAR.

  Cada obra vira uma rota:  #/obra/<id>
  O QR code ao lado da obra aponta para  https://SEU-SITE/#/obra/<id>

  imagens       → tentadas em ordem. Coloque o arquivo em public/obras/<id>.jpg para não depender da internet;
                  as URLs do Wikimedia Commons (domínio público) são o plano B.
  profundidade  → mapa de profundidade pré-calculado (opcional). Gere em #/painel e salve em public/obras/.
                  Sem ele, o app calcula na hora com IA (só na 1ª visita de cada aparelho; depois fica em cache).
  ambiente      → como a tela vira um lugar:
                  campo       ângulo horizontal (graus) que a tela ocupa ao seu redor. 360 / campo deve ser PAR.
                  horizonte   altura da linha do horizonte na tela (0 = topo, 1 = base) → fica na altura dos seus olhos
                  perto/longe distâncias (metros) do primeiro plano e do fundo
                  olho        altura dos olhos em relação ao chão da cena
  pontos        → pontos de interesse: u/v são a posição na tela (0–1, origem no canto superior esquerdo).
                  As posições abaixo são aproximadas: ajuste olhando a cena.
*/

const commons = (arquivo, largura) => {
  // Caminho de miniatura do Wikimedia: /thumb/<h1>/<h2>/<arquivo>/<largura>px-<arquivo>
  const nome = arquivo.replace(/ /g, "_");
  const hash = HASHES[nome];
  const enc = encodeURIComponent(nome);
  return largura
    ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash}/${enc}/${largura}px-${enc}`
    : `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash}/${enc}`;
};
// md5(nome do arquivo) → os dois primeiros caracteres formam a pasta do Commons
const HASHES = {
  "Pedro_Américo_-_Independência_ou_Morte_-_Google_Art_Project.jpg": "7e",
  "Independência_ou_Morte_(Pedro_Américo).jpg": "a6",
};

export const OBRAS = [
  {
    id: "independencia-ou-morte",
    titulo: "Independência ou Morte!",
    artista: "Pedro Américo",
    ano: 1888,
    tecnica: "óleo sobre tela",
    dimensoes: "415 × 760 cm",
    acervo: "Museu Paulista da USP (Museu do Ipiranga), São Paulo",
    cena: "7 de setembro de 1822, às margens do riacho do Ipiranga.",
    resumo:
      "Encomendada para o salão nobre do Museu Paulista e pintada em Florença, a tela é uma versão idealizada do momento da Independência: uniformes de gala, cavalos imponentes e uma composição pensada como monumento.",
    creditoImagem: "Imagem: Wikimedia Commons, domínio público",
    imagens: [
      "obras/independencia-ou-morte.jpg",
      commons("Pedro_Américo_-_Independência_ou_Morte_-_Google_Art_Project.jpg", 2560),
      commons("Pedro_Américo_-_Independência_ou_Morte_-_Google_Art_Project.jpg", 1920),
      commons("Independência_ou_Morte_(Pedro_Américo).jpg", 2560),
      commons("Independência_ou_Morte_(Pedro_Américo).jpg", 1920),
      commons("Independência_ou_Morte_(Pedro_Américo).jpg"),
    ],
    profundidade: "obras/independencia-ou-morte-profundidade.png",
    ambiente: { campo: 90, horizonte: 0.46, perto: 3.2, longe: 42, olho: 1.6 },
    pontos: [
      {
        id: "dom-pedro",
        u: 0.62, v: 0.33,
        titulo: "D. Pedro I",
        texto:
          "No alto da colina, de espada erguida, o príncipe regente proclama a separação de Portugal. Historiadores apontam que a viagem foi feita em montaria de tropa, mais rústica que o cavalo heroico do quadro.",
      },
      {
        id: "dragoes",
        u: 0.3, v: 0.45,
        titulo: "A Guarda de Honra",
        texto:
          "Os cavaleiros erguem as espadas e respondem ao gesto do príncipe. Os uniformes de gala reforçam o tom solene que Pedro Américo quis dar à cena.",
      },
      {
        id: "carreiro",
        u: 0.08, v: 0.72,
        titulo: "O carreiro",
        texto:
          "Um homem com seu carro de bois observa a cena à margem da estrada. Ele representa o povo comum, que assiste ao acontecimento sem participar dele.",
      },
      {
        id: "casa",
        u: 0.9, v: 0.34,
        titulo: "A casa à beira do caminho",
        texto:
          "A construção ao fundo situa a cena no caminho de Santos a São Paulo. Ela inspirou o nome da Casa do Grito, que hoje fica no Parque da Independência, perto do museu.",
      },
    ],
  },
];

export const obraPorId = (id) => OBRAS.find((o) => o.id === id);
