import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { OBRAS } from "../obras.js";
import { obterImagem } from "../engine/imagem.js";
import { calcularComIA, suavizar, profundidadeParaPNG } from "../engine/profundidade.js";

/*
  Painel da equipe (#/painel):
  - Placas com QR code para imprimir e colocar ao lado das obras.
  - Gerador do mapa de profundidade: calcule uma vez, salve em public/obras/ e os visitantes não precisam baixar a IA.
*/
const baseAtual = () => `${location.origin}${location.pathname}`;

function Placa({ obra, base }) {
  const [qr, setQr] = useState(null);
  const url = `${base.replace(/#.*$/, "")}#/obra/${obra.id}`;
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 440, errorCorrectionLevel: "M", color: { dark: "#2a2019", light: "#f1e8d9" } }).then(setQr);
  }, [url]);
  return (
    <div className="placa">
      <div className="t">{obra.titulo}</div>
      <div className="m">{obra.artista}, {obra.ano}</div>
      {qr && <img src={qr} alt={`QR code para ${obra.titulo}`} />}
      <div className="cta">Escaneie e entre no quadro</div>
      <div className="url">{url}</div>
    </div>
  );
}

function GeradorProfundidade({ obra }) {
  const ref = useRef(null);
  const [estado, setEstado] = useState("");
  const [png, setPng] = useState(null);
  async function gerar() {
    setEstado("Carregando a imagem…");
    try {
      const { img } = await obterImagem(obra.imagens);
      const p = suavizar(
        await calcularComIA(img, (m) => setEstado(m.etapa === "baixando" ? `Baixando o modelo ${m.pct}%` : "Calculando…")),
        1
      );
      const blob = await profundidadeParaPNG(p);
      const url = URL.createObjectURL(blob);
      setPng(url);
      const c = ref.current, ctx = c.getContext("2d");
      const im = await createImageBitmap(blob);
      c.width = im.width; c.height = im.height;
      ctx.drawImage(im, 0, 0);
      setEstado(`Pronto: ${p.largura} × ${p.altura}px. Salve como public/obras/${obra.id}-profundidade.png`);
    } catch (e) {
      setEstado(`Falhou: ${e.message || e}`);
    }
  }
  return (
    <div className="ferramenta nao-imprimir">
      <h2>Profundidade · {obra.titulo}</h2>
      <p>Claro é perto, escuro é longe. Se alguma área ficar errada, dá para retocar o PNG num editor de imagem.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={gerar}>Gerar mapa de profundidade</button>
        {png && <a className="btn ouro" href={png} download={`${obra.id}-profundidade.png`}>Baixar PNG</a>}
      </div>
      {estado && <p>{estado}</p>}
      <canvas ref={ref} width="0" height="0" />
    </div>
  );
}

export default function Painel() {
  const [base, setBase] = useState(baseAtual());
  return (
    <main className="painel">
      <header className="nao-imprimir" style={{ display: "grid", gap: 12 }}>
        <div className="eyebrow">CulturAR · painel da equipe</div>
        <h1 className="titulo-display">Placas com QR code</h1>
        <div className="campo">
          <label htmlFor="base">Endereço público do app (o QR aponta para cá)</label>
          <input id="base" value={base} onChange={(e) => setBase(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn ouro" onClick={() => window.print()}>Imprimir placas</button>
          <a className="btn" href="#/validacao">Roteiro de validação</a>
          <a className="btn" href="#/">Voltar</a>
        </div>
      </header>
      <div className="placa-grade">
        {OBRAS.map((o) => <Placa key={o.id} obra={o} base={base} />)}
      </div>
      {OBRAS.map((o) => <GeradorProfundidade key={o.id} obra={o} />)}
    </main>
  );
}
