import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { obraPorId } from "../obras.js";
import { IconeVoltar } from "../icones.jsx";
import { registrar } from "../validacao.js";

// Lê QR codes com BarcodeDetector (Android/Chrome) ou jsQR (iPhone e demais).
// No iPhone a câmera nativa também lê o QR e abre o link direto: este leitor é um atalho dentro do app.
export default function Scanner() {
  const videoRef = useRef(null);
  const [msg, setMsg] = useState("Aponte para o QR code ao lado da obra");

  useEffect(() => {
    let stream, raf, vivo = true, estranho = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const detector = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;

    const tratar = (texto) => {
      const m = texto.match(/#\/obra\/([\w-]+)/);
      if (m && obraPorId(m[1])) { vivo = false; registrar("qr-interno", "ok"); location.hash = `/obra/${m[1]}`; return true; }
      setMsg("Esse QR code não é de uma obra do CulturAR");
      if (!estranho) { estranho = true; registrar("qr-estranho", true); }
      return false;
    };

    const ler = async () => {
      if (!vivo) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        try {
          if (detector) {
            const r = await detector.detect(v);
            if (r[0] && tratar(r[0].rawValue)) return;
          } else {
            const w = 480, h = Math.round((w * v.videoHeight) / v.videoWidth);
            canvas.width = w; canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (r && tratar(r.data)) return;
          }
        } catch { /* quadro ruim, segue */ }
      }
      raf = setTimeout(() => requestAnimationFrame(ler), 120);
    };

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        stream = s;
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = s;
        await videoRef.current.play();
        ler();
      })
      .catch(() => { registrar("qr-interno", "sem-camera"); setMsg("Sem acesso à câmera. Libere a permissão ou use a câmera do celular para ler o QR."); });

    return () => { vivo = false; clearTimeout(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted />
      <div className="mira" />
      <div className="legenda">{msg}</div>
      <div className="barra-topo">
        <a className="chip icone" href="#/" aria-label="Voltar"><IconeVoltar /></a>
      </div>
    </div>
  );
}
