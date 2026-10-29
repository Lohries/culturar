import React, { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "../engine/Engine.js";
import { obterImagem } from "../engine/imagem.js";
import { obterProfundidade } from "../engine/profundidade.js";
import { pedirPermissaoMovimento } from "../engine/orientacao.js";
import { Recorte } from "../engine/recorte.js";
import { registrar, emValidacao } from "../validacao.js";
import { IconeVoltar, IconeOlhar, IconeSelfie, IconeInfo, IconePortal } from "../icones.jsx";

export default function Obra({ obra }) {
  const canvasRef = useRef(null);
  const videoFundoRef = useRef(null);
  const engineRef = useRef(null);
  const recorteRef = useRef(null);
  const pontosRef = useRef([]);
  const pontos3D = useRef([]);

  const [img, setImg] = useState(null);
  const [fase, setFase] = useState("carregando"); // carregando | pronto | erro | portal | travessia | dentro
  const [modo, setModo] = useState("olhar");
  const [prof, setProf] = useState({ texto: "Preparando o espaço 3D…", ok: false });
  const [comCamera, setComCamera] = useState(false);
  const [folha, setFolha] = useState(null);
  const [foto, setFoto] = useState(null);
  const [toast, setToast] = useState("");
  const [efeito, setEfeito] = useState(null); // "passagem" | "flash"
  const [ligandoSelfie, setLigandoSelfie] = useState(false);
  const [validando] = useState(emValidacao);

  const avisar = useCallback((m) => {
    setToast(m);
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => setToast(""), 3600);
  }, []);

  // 1. imagem da obra + motor 3D
  useEffect(() => {
    let vivo = true;
    const t0 = performance.now();
    obterImagem(obra.imagens)
      .then(({ img, fonte }) => {
        if (!vivo) return;
        setImg(img);
        registrar("imagem", /^https?:/.test(fonte) ? "internet" : "arquivo");
        registrar("tempo-pronto", Math.round((performance.now() - t0) / 100) / 10);
        const eng = new Engine(canvasRef.current, { obra, img });
        engineRef.current = eng;
        pontos3D.current = obra.pontos.map((p) => eng.pontoNaCena(p.u, p.v));
        eng.aoPassar = () => { pararCameraFundo(); setEfeito("passagem"); };
        eng.aoEntrar = () => setFase("dentro");
        eng.aoQuadro = moverPontos;
        setFase("pronto");

        // 2. profundidade (pode chegar depois que a pessoa já entrou)
        obterProfundidade(obra, img, (m) => {
          if (m.etapa === "baixando") setProf({ texto: `Baixando IA de profundidade ${m.pct}%`, ok: false });
          else setProf({ texto: "Calculando a profundidade da cena…", ok: false });
        })
          .then((p) => {
            if (!vivo) return;
            eng.definirProfundidade(p);
            registrar("profundidade", p.fonte);
            pontos3D.current = obra.pontos.map((pt) => eng.pontoNaCena(pt.u, pt.v));
            setProf({ texto: "Cena em 3D", ok: true });
          })
          .catch(() => {
            registrar("profundidade", "falhou");
            if (vivo) setProf({ texto: "Cena em modo simples (sem IA de profundidade)", ok: true });
          });
      })
      .catch(() => { registrar("imagem", "erro"); if (vivo) setFase("erro"); });

    return () => {
      vivo = false;
      pararCameraFundo();
      recorteRef.current?.parar();
      engineRef.current?.destruir();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obra]);

  // pontos de interesse acompanham a cena (sem re-render do React)
  const faseRef = useRef(fase), modoRef = useRef(modo);
  faseRef.current = fase; modoRef.current = modo;
  function moverPontos(eng) {
    const mostrar = faseRef.current === "dentro" && modoRef.current === "olhar";
    pontosRef.current.forEach((el, i) => {
      if (!el) return;
      const s = mostrar ? eng.projetar(pontos3D.current[i]) : null;
      if (!s) { el.hidden = true; return; }
      el.hidden = false;
      el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    });
  }

  function pararCameraFundo() {
    const v = videoFundoRef.current;
    v?.srcObject?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setComCamera(false);
  }

  // 3. entrar: permissão de movimento (iPhone) + câmera traseira para o portal
  async function entrar() {
    const permissao = pedirPermissaoMovimento(); // precisa sair direto do toque
    let cam = false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      videoFundoRef.current.srcObject = s;
      await videoFundoRef.current.play();
      cam = true;
    } catch { /* sem câmera: o portal aparece na parede do museu */ }
    const mov = await permissao;
    registrar("camera-traseira", cam ? "ok" : "negada");
    registrar("movimento", mov ? "ok" : "negado");
    if (!mov) avisar("Sem acesso ao movimento do celular. Arraste a tela para olhar em volta.");
    setComCamera(cam);
    engineRef.current.abrirPortal(cam);
    setFase("portal");
  }

  function atravessar() { if (faseRef.current !== "portal") return; registrar("travessia", "atravessou"); engineRef.current?.atravessar(); setFase("travessia"); }
  function pularPortal() { registrar("travessia", "pulou"); pararCameraFundo(); engineRef.current.entrarDireto(); setFase("dentro"); }

  async function mudarModo(novo) {
    if (novo === modo || ligandoSelfie) return;
    const eng = engineRef.current;
    setFolha(null);
    if (novo === "selfie") {
      setLigandoSelfie(true);
      avisar("Ligando a câmera frontal…");
      try {
        if (!recorteRef.current) recorteRef.current = new Recorte();
        await recorteRef.current.iniciar();
        eng.definirModo("selfie", recorteRef.current);
        setModo("selfie");
        registrar("selfie", "ok");
        avisar("Vire-se: a cena está atrás de você. Gire o celular para escolher o fundo.");
      } catch {
        registrar("selfie", "falhou");
        avisar("Não deu para usar a câmera frontal. Confira a permissão do navegador.");
      } finally {
        setLigandoSelfie(false);
      }
    } else {
      recorteRef.current?.parar();
      eng.definirModo("olhar");
      eng.orientacao.realinhar();
      setModo("olhar");
    }
  }

  async function fotografar() {
    setEfeito("flash");
    const blob = await engineRef.current.fotografar();
    const final = await comporFoto(blob, modo === "selfie", obra);
    setFoto({ blob: final, url: URL.createObjectURL(final) });
    registrar("foto", modo);
  }

  async function compartilhar() {
    const arquivo = new File([foto.blob], `culturar-${obra.id}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [arquivo] })) {
      registrar("compartilhar", "menu");
      try { await navigator.share({ files: [arquivo], title: obra.titulo, text: `Eu dentro de ${obra.titulo}, de ${obra.artista}` }); } catch { /* cancelado */ }
    } else {
      registrar("compartilhar", "baixou");
      baixar();
    }
  }
  function baixar() {
    const a = document.createElement("a");
    a.href = foto.url;
    a.download = `culturar-${obra.id}.jpg`;
    a.click();
  }

  const dentro = fase === "dentro";

  return (
    <div className={`palco ${dentro ? "dentro" : ""}`}>
      <video ref={videoFundoRef} className="fundo" playsInline muted hidden={!comCamera} />
      <canvas
        ref={canvasRef}
        className={`cena ${dentro && modo === "selfie" ? "espelho" : ""}`}
        style={{ visibility: fase === "portal" || fase === "travessia" || dentro ? "visible" : "hidden" }}
        onClick={() => fase === "portal" && atravessar()}
        aria-label={`Cena de ${obra.titulo}`}
      />
      {dentro && <div className="vinheta" />}

      {/* pontos de interesse */}
      <div className="pontos">
        {obra.pontos.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => (pontosRef.current[i] = el)}
            className="ponto"
            hidden
            aria-label={p.titulo}
            onClick={(e) => { e.stopPropagation(); registrar("ponto-aberto", p.id); setFolha(p); }}
          />
        ))}
      </div>

      {/* entrada */}
      {(fase === "carregando" || fase === "pronto" || fase === "erro") && (
        <div className="entrada">
          <div className="entrada-card">
            <div className="eyebrow">CulturAR · você encontrou uma obra</div>
            <div className="moldura">
              <div className={`tela ${img ? "" : "carregando"}`} style={img ? { backgroundImage: `url("${img.src}")` } : undefined} />
            </div>
            <div className="etiqueta">
              <div className="t">{obra.titulo}</div>
              <div className="m">{obra.artista}, {obra.ano} · {obra.tecnica} · {obra.dimensoes}</div>
              <div className="m">{obra.acervo}</div>
              <p>{obra.cena}</p>
            </div>
            {fase === "erro" ? (
              <p className="dica">
                Não consegui carregar a imagem da obra. Verifique a internet ou coloque o arquivo em
                <code> public/obras/{obra.id}.jpg</code>.
              </p>
            ) : (
              <>
                <div className="acoes">
                  <button className="btn ouro grande" onClick={entrar} disabled={fase !== "pronto"}>
                    <IconePortal /> {fase === "pronto" ? "Entrar no quadro" : "Carregando a obra…"}
                  </button>
                  <a className="btn" href="#/">Acervo</a>
                  {validando && <a className="btn" href="#/validacao">Roteiro</a>}
                </div>
                <p className="dica">Vamos pedir a câmera e o movimento do celular. Fique num lugar com espaço para girar o corpo.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* portal */}
      {fase === "portal" && (
        <>
          <div className="instrucao">
            {comCamera ? "A obra está aberta à sua frente. Toque na moldura para atravessar." : "Toque na moldura para atravessar."}
          </div>
          <div className="barra-base">
            <button className="btn ouro grande" onClick={atravessar}><IconePortal /> Atravessar</button>
            <button className="btn" onClick={pularPortal}>Pular</button>
          </div>
        </>
      )}

      {/* dentro */}
      {(fase === "portal" || fase === "travessia" || dentro) && (
        <div className="barra-topo">
          <a className="chip icone" href="#/" aria-label="Sair da obra"><IconeVoltar /></a>
          {validando && <a className="chip" href="#/validacao">Roteiro</a>}
          {dentro && <div className="chip" style={{ minWidth: 0, flex: "0 1 auto" }}><span className="t">{obra.titulo}</span></div>}
          {dentro ? (
            <button className="chip icone" aria-label="Sobre a obra" onClick={() => setFolha(folha?.id === "sobre" ? null : { id: "sobre", titulo: obra.titulo, texto: obra.resumo })}><IconeInfo /></button>
          ) : (
            <div className="chip status"><span className={`ponto-status ${prof.ok ? "ok" : ""}`} />{prof.texto}</div>
          )}
        </div>
      )}

      {dentro && (
        <div className="barra-base">
          <div className="vidro-grupo" role="group" aria-label="Modo">
            <button className="btn" aria-pressed={modo === "olhar"} onClick={() => mudarModo("olhar")}><IconeOlhar /> Olhar</button>
            <button className="btn" aria-pressed={modo === "selfie"} onClick={() => mudarModo("selfie")} disabled={ligandoSelfie}><IconeSelfie /> Selfie</button>
          </div>
          <button className="obturador" aria-label="Tirar foto" onClick={fotografar} />
        </div>
      )}
      {dentro && !prof.ok && (
        <div className="chip status" style={{ position: "absolute", left: 16, top: "calc(64px + env(safe-area-inset-top, 0px))" }}>
          <span className="ponto-status" />{prof.texto}
        </div>
      )}

      {folha && (
        <div className="folha" role="dialog" aria-label={folha.titulo}>
          <div className="t">{folha.titulo}</div>
          <p>{folha.texto}</p>
          <button className="fechar" onClick={() => setFolha(null)}>Fechar</button>
        </div>
      )}

      {efeito && <div className={efeito} onAnimationEnd={() => setEfeito(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}

      {foto && (
        <div className="foto-preview">
          <img src={foto.url} alt={`Você dentro de ${obra.titulo}`} />
          <div className="acoes">
            <button className="btn ouro" onClick={compartilhar}>Compartilhar</button>
            <button className="btn" onClick={baixar}>Salvar</button>
            <button className="btn" onClick={() => { URL.revokeObjectURL(foto.url); setFoto(null); }}>Voltar à cena</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Foto final com a etiqueta do museu embaixo.
async function comporFoto(blob, espelhar, obra) {
  const bmp = await createImageBitmap(blob);
  const W = bmp.width, faixa = Math.round(Math.max(110, W * 0.1)), H = bmp.height + faixa;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.save();
  if (espelhar) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(bmp, 0, 0);
  ctx.restore();
  ctx.fillStyle = "#f1e8d9";
  ctx.fillRect(0, bmp.height, W, faixa);
  ctx.fillStyle = "#c9a356";
  ctx.fillRect(0, bmp.height, W, Math.max(3, Math.round(faixa * 0.04)));
  await document.fonts?.ready;
  const m = Math.round(faixa * 0.3);
  ctx.fillStyle = "#2a2019";
  ctx.font = `italic 500 ${Math.round(faixa * 0.3)}px "Bodoni Moda", Georgia, serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(obra.titulo, m, bmp.height + faixa * 0.5);
  ctx.fillStyle = "#5b4c40";
  ctx.font = `400 ${Math.round(faixa * 0.15)}px "IBM Plex Mono", monospace`;
  ctx.fillText(`${obra.artista}, ${obra.ano} · com participação especial de você`, m, bmp.height + faixa * 0.78);
  ctx.textAlign = "right";
  ctx.fillStyle = "#8a6d35";
  ctx.font = `700 ${Math.round(faixa * 0.15)}px "IBM Plex Mono", monospace`;
  ctx.fillText("CULTURAR", W - m, bmp.height + faixa * 0.78);
  return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.92));
}
