import React, { useEffect, useState } from "react";
import { OBRAS } from "../obras.js";
import { IconeQR } from "../icones.jsx";
import { primeiraImagemDisponivel } from "../engine/imagem.js";
import { emValidacao } from "../validacao.js";

function Capa({ obra }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let vivo = true;
    primeiraImagemDisponivel(obra.imagens).then((u) => vivo && setUrl(u)).catch(() => {});
    return () => { vivo = false; };
  }, [obra]);
  return <div className="tela" style={url ? { backgroundImage: `url("${url}")` } : undefined} />;
}

export default function Home({ aviso }) {
  return (
    <main className="home">
      <header>
        <div className="marca">CULTURAR</div>
        <h1 className="titulo-display">Escaneie a obra. <b>Entre nela.</b></h1>
        <p className="lead">
          Aponte a câmera para o QR code ao lado do quadro. A tela vira um lugar ao seu redor: você olha em volta
          movendo o celular e pode tirar uma selfie dentro da cena.
        </p>
        <div className="acoes">
          <a className="btn ouro grande" href="#/escanear"><IconeQR /> Escanear QR code</a>
        </div>
        {aviso && <div className="aviso" role="status">{aviso}</div>}
        {emValidacao() && (
          <div className="aviso">Teste de validação em andamento. <a href="#/validacao">Voltar ao roteiro</a></div>
        )}
      </header>

      <section style={{ display: "grid", gap: 14 }}>
        <div className="eyebrow">Acervo</div>
        <div className="acervo">
          {OBRAS.map((o) => (
            <a key={o.id} className="cartao-obra" href={`#/obra/${o.id}`}>
              <div className="mini-moldura"><Capa obra={o} /></div>
              <div>
                <div className="t">{o.titulo}</div>
                <div className="m">{o.artista}, {o.ano} · {o.acervo}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
