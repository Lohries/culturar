import React, { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Scanner from "./pages/Scanner.jsx";
import Obra from "./pages/Obra.jsx";
import Painel from "./pages/Painel.jsx";
import Validacao from "./pages/Validacao.jsx";
import { obraPorId } from "./obras.js";

// Rotas por hash (#/obra/id): funcionam em qualquer hospedagem estática sem configurar redirecionamentos.
function useRota() {
  const ler = () => (location.hash.replace(/^#/, "") || "/").split("?")[0];
  const [rota, setRota] = useState(ler);
  useEffect(() => {
    const f = () => setRota(ler());
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return rota;
}
export const ir = (r) => { location.hash = r; };

export default function App() {
  const rota = useRota();
  const partes = rota.split("/").filter(Boolean);

  if (partes[0] === "escanear") return <Scanner />;
  if (partes[0] === "painel") return <Painel />;
  if (partes[0] === "validacao") return <Validacao />;
  if (partes[0] === "obra") {
    const obra = obraPorId(partes[1]);
    if (obra) return <Obra key={obra.id} obra={obra} />;
    return <Home aviso="Esse QR code aponta para uma obra que não está no acervo." />;
  }
  return <Home />;
}
