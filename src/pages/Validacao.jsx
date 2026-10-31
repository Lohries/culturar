import React, { useEffect, useMemo, useState } from "react";
import { OBRAS } from "../obras.js";
import {
  ETAPAS, TODOS_ITENS, ESCALAS, RESULTADOS, VEREDITOS,
  lerDiagnostico, limparDiagnostico, detectarAparelho, iniciarValidacao, encerrarValidacao,
  lerTestes, salvarTeste, apagarTeste, carregarExemplos, removerExemplos, lerRascunho, gravarRascunho, limparRascunho, paraCSV,
} from "../validacao.js";

/*
  Roteiro de validação (#/validacao): o testador começa aqui, faz a experiência e volta para marcar cada passo.
  Os passos que o app consegue detectar sozinho já vêm sugeridos; o testador confirma ou corrige.
*/

const ROTULOS_DIAG = {
  "imagem": ["Imagem da obra", { arquivo: "arquivo local", internet: "Wikimedia (internet)", erro: "não carregou" }],
  "tempo-pronto": ["Tempo até “Entrar no quadro”", null, (x) => `${x} s`],
  "profundidade": ["Profundidade", { arquivo: "mapa pré-calculado", cache: "cache do aparelho", ia: "IA no aparelho (1ª visita)", falhou: "falhou → modo simples" }],
  "camera-traseira": ["Câmera traseira", { ok: "liberada", negada: "negada ou indisponível" }],
  "movimento": ["Movimento do celular", { ok: "liberado", negado: "negado" }],
  "travessia": ["Portal", { atravessou: "atravessou", pulou: "pulou" }],
  "ponto-aberto": ["Ponto de interesse aberto", null],
  "selfie": ["Câmera frontal", { ok: "ligou", falhou: "falhou" }],
  "foto": ["Foto", { olhar: "tirada no modo Olhar", selfie: "tirada no modo Selfie" }],
  "compartilhar": ["Compartilhar", { menu: "abriu o menu do celular", baixou: "sem menu, baixou o arquivo" }],
  "qr-interno": ["Leitor de QR do app", { ok: "leu a placa", "sem-camera": "sem câmera" }],
  "qr-estranho": ["QR de fora do acervo", null, () => "reconhecido como estranho"],
};

function formInicial(diag, aparelho) {
  const sugestoes = {};
  TODOS_ITENS.forEach((i) => { const r = i.auto?.(diag); if (r) sugestoes[i.id] = { r, nota: "", auto: true }; });
  const prof = diag.profundidade?.valor;
  return {
    testador: "", papel: "visitante", aparelho: "",
    sistema: aparelho.sistema, navegador: aparelho.navegador, rede: "Wi-Fi do museu", endereco: aparelho.endereco,
    obra: OBRAS[0].id, primeiraVisita: prof ? prof === "ia" : true,
    tempoCarregar: diag["tempo-pronto"]?.valor ?? "",
    itens: sugestoes, notas: {}, gostou: "", problemas: "", sugestoes: "", veredito: "",
  };
}

export default function Validacao() {
  const aparelho = useMemo(detectarAparelho, []);
  const [diag, setDiag] = useState(lerDiagnostico);
  const [f, setF] = useState(() => lerRascunho() || formInicial(lerDiagnostico(), aparelho));
  const [testes, setTestes] = useState(lerTestes);
  const [msg, setMsg] = useState({ texto: "", tipo: "" });
  const [enviado, setEnviado] = useState(null);

  useEffect(() => { gravarRascunho(f); }, [f]);

  const muda = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));
  const marcar = (id, r) => setF((x) => ({ ...x, itens: { ...x.itens, [id]: { r, nota: x.itens[id]?.nota || "" } } }));
  const anotar = (id, nota) => setF((x) => ({ ...x, itens: { ...x.itens, [id]: { ...x.itens[id], nota } } }));

  function comecar() {
    limparDiagnostico();
    limparRascunho();
    iniciarValidacao();
    location.hash = `/obra/${f.obra}`;
  }
  function recarregarSugestoes() {
    const d = lerDiagnostico();
    setDiag(d);
    setF((x) => {
      const base = formInicial(d, aparelho);
      // mantém o que o testador já marcou à mão; só preenche o que ainda está vazio ou era sugestão
      const itens = { ...base.itens };
      Object.entries(x.itens).forEach(([k, val]) => { if (!val.auto) itens[k] = val; });
      return { ...x, itens, primeiraVisita: base.primeiraVisita, tempoCarregar: x.tempoCarregar === "" ? base.tempoCarregar : x.tempoCarregar };
    });
  }
  function limpar() {
    limparRascunho();
    setF(formInicial(lerDiagnostico(), aparelho));
    setMsg({ texto: "", tipo: "" });
  }

  function enviar(e) {
    e.preventDefault();
    if (!f.aparelho.trim()) return setMsg({ texto: "Informe o modelo do celular na etapa 00.", tipo: "erro" });
    if (!Object.keys(f.itens).length) return setMsg({ texto: "Marque pelo menos um passo antes de salvar.", tipo: "erro" });
    if (!f.veredito) return setMsg({ texto: "Escolha um veredito na etapa 08.", tipo: "erro" });
    const itens = Object.fromEntries(Object.entries(f.itens).map(([k, { r, nota }]) => [k, { r, nota: nota.trim() }]));
    const teste = {
      ...f, itens, aparelho: f.aparelho.trim(),
      tempoCarregar: f.tempoCarregar === "" ? null : Number(f.tempoCarregar),
      fonteProfundidade: diag.profundidade?.valor || "", diagnostico: diag, ua: aparelho.ua,
    };
    const todos = salvarTeste(teste);
    setTestes(todos);
    setEnviado(todos[0]);
    encerrarValidacao();
    limparRascunho();
    setF(formInicial({}, aparelho));
    setMsg({ texto: "", tipo: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="validacao">
      <header>
        <div className="eyebrow">CulturAR · roteiro de validação</div>
        <h1 className="titulo-display">Roteiro de <b>validação</b></h1>
        <p className="lead">
          Toque em <strong>Começar teste</strong>, faça a experiência inteira da obra e volte para cá pelo botão
          <strong> Roteiro</strong> no topo da tela. O app anota o que consegue detectar e já sugere o resultado desses
          passos. Confirme ou corrija cada um. Leva uns 10 minutos.
        </p>
        <div className="acoes">
          <button className="btn ouro grande" onClick={comecar}>Começar teste</button>
          <a className="btn" href="#/">Acervo</a>
          {import.meta.env.DEV && (testes.some((t) => t.exemplo)
            ? <button className="btn" onClick={() => setTestes(removerExemplos())}>Remover dados de exemplo</button>
            : <button className="btn" onClick={async () => setTestes(await carregarExemplos())}>Carregar dados de exemplo</button>)}
        </div>
      </header>

      {enviado && <Enviado teste={enviado} todos={testes} fechar={() => setEnviado(null)} />}

      <section className="v-diag">
        <div className="v-cab-linha">
          <h2>Detectado neste aparelho</h2>
          <button className="btn" onClick={recarregarSugestoes}>Atualizar</button>
        </div>
        <dl>
          <div><dt>Sistema</dt><dd>{aparelho.sistema}{aparelho.versao && ` · ${aparelho.versao}`}</dd></div>
          <div><dt>Navegador</dt><dd>{aparelho.navegador}</dd></div>
          <div><dt>Tela</dt><dd>{aparelho.tela}</dd></div>
          <Recurso nome="HTTPS" ok={aparelho.https} falta="câmera e giroscópio não funcionam" />
          <Recurso nome="Câmera" ok={aparelho.camera} falta="navegador sem acesso à câmera" />
          <Recurso nome="Giroscópio" ok={aparelho.giroscopio} falta="só dá para arrastar a tela" />
          <Recurso nome="OffscreenCanvas" ok={aparelho.offscreen} falta="profundidade não funciona (iOS < 16.4?)" />
          <Recurso nome="Leitor de QR nativo" ok={aparelho.barcode} falta="usa o leitor jsQR (normal no iPhone)" neutro />
        </dl>
        {Object.keys(diag).length > 0 ? (
          <dl className="v-anotacoes">
            {Object.entries(diag).map(([k, { valor }]) => {
              const [rot, mapa, fmt] = ROTULOS_DIAG[k] || [k];
              return <div key={k}><dt>{rot}</dt><dd>{fmt ? fmt(valor) : mapa?.[valor] ?? String(valor)}</dd></div>;
            })}
          </dl>
        ) : (
          <p className="v-vazio">Nenhuma anotação da experiência ainda. Toque em Começar teste.</p>
        )}
      </section>

      <form onSubmit={enviar} noValidate>
        <Etapa num="00" titulo="Você e o aparelho" desc="Os resultados mudam muito entre iPhone e Android, e entre a primeira visita e as seguintes.">
          <div className="v-grade">
            <Campo id="testador" rot="Seu nome"><input id="testador" value={f.testador} onChange={muda("testador")} autoComplete="name" /></Campo>
            <Campo id="papel" rot="Seu papel">
              <select id="papel" value={f.papel} onChange={muda("papel")}>
                <option value="visitante">Visitante</option><option value="equipe">Equipe do museu</option><option value="dev">Desenvolvimento</option>
              </select>
            </Campo>
            <Campo id="aparelho" rot="Modelo do celular"><input id="aparelho" value={f.aparelho} onChange={muda("aparelho")} placeholder="ex.: iPhone 13, Galaxy A54" /></Campo>
            <Campo id="sistema" rot="Sistema"><Opcoes id="sistema" valor={f.sistema} onChange={muda("sistema")} lista={["iOS", "Android", "Computador"]} /></Campo>
            <Campo id="navegador" rot="Navegador"><Opcoes id="navegador" valor={f.navegador} onChange={muda("navegador")} lista={["Safari", "Chrome", "Samsung Internet", "Firefox", "Outro"]} /></Campo>
            <Campo id="rede" rot="Conexão"><Opcoes id="rede" valor={f.rede} onChange={muda("rede")} lista={["Wi-Fi do museu", "Wi-Fi local (teste)", "4G", "5G"]} /></Campo>
            <Campo id="endereco" rot="Versão testada">
              <select id="endereco" value={f.endereco} onChange={muda("endereco")}>
                <option value="publicado">Site publicado (HTTPS)</option><option value="rede-local">npm run celular (rede local)</option><option value="localhost">localhost no computador</option>
              </select>
            </Campo>
            <Campo id="obra" rot="Obra">
              <select id="obra" value={f.obra} onChange={muda("obra")}>
                {OBRAS.map((o) => <option key={o.id} value={o.id}>{o.titulo} ({o.artista}, {o.ano})</option>)}
              </select>
            </Campo>
            <Campo id="primeira" rot="Primeira vez neste aparelho?">
              <select id="primeira" value={f.primeiraVisita ? "sim" : "nao"} onChange={(e) => setF((x) => ({ ...x, primeiraVisita: e.target.value === "sim" }))}>
                <option value="sim">Sim, nunca abri</option><option value="nao">Não, já abri antes</option>
              </select>
            </Campo>
          </div>
        </Etapa>

        {ETAPAS.map((e, idx) => (
          <Etapa key={e.id} num={String(idx + 1).padStart(2, "0")} titulo={e.titulo} desc={e.desc}>
            {e.itens.map((i) => {
              const marcado = f.itens[i.id];
              return (
                <div key={i.id} className="v-item" data-r={marcado?.r}>
                  <div className="v-item-linha">
                    <div className="v-item-texto">
                      {i.t}
                      {i.d && <small>{i.d}</small>}
                      {marcado?.auto && <small className="v-auto">Sugerido pelo que o app detectou. Confirme.</small>}
                    </div>
                    <div className="v-seg" role="radiogroup" aria-label={i.t}>
                      {RESULTADOS.map(([v, r]) => (
                        <React.Fragment key={v}>
                          <input type="radio" id={`${i.id}-${v}`} name={`item-${i.id}`} value={v} checked={marcado?.r === v} onChange={() => marcar(i.id, v)} />
                          <label htmlFor={`${i.id}-${v}`}>{r}</label>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  {(marcado?.r === "parcial" || marcado?.r === "falha") && (
                    <input className="v-nota" value={marcado.nota} onChange={(ev) => anotar(i.id, ev.target.value)}
                      placeholder="O que aconteceu?" aria-label={`O que aconteceu em: ${i.t}`} />
                  )}
                </div>
              );
            })}
          </Etapa>
        ))}

        <Etapa num="07" titulo="Sua impressão" desc="De 1 (ruim) a 5 (ótimo).">
          <div className="v-grade">
            {ESCALAS.map((s) => (
              <div key={s.id} className="v-campo">
                <span className="v-rot">{s.t}</span>
                <div className="v-escala" role="radiogroup" aria-label={s.t}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <React.Fragment key={n}>
                      <input type="radio" id={`${s.id}-${n}`} name={`escala-${s.id}`} checked={f.notas[s.id] === n}
                        onChange={() => setF((x) => ({ ...x, notas: { ...x.notas, [s.id]: n } }))} />
                      <label htmlFor={`${s.id}-${n}`}>{n}</label>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Campo id="tempo" rot="Quanto tempo do QR até o botão “Entrar no quadro” ficar ativo? (segundos)">
            <input id="tempo" type="number" min="0" step="0.1" inputMode="decimal" value={f.tempoCarregar} onChange={muda("tempoCarregar")} style={{ maxWidth: 160 }} />
          </Campo>
          <Campo id="gostou" rot="O que mais funcionou?"><textarea id="gostou" value={f.gostou} onChange={muda("gostou")} /></Campo>
          <Campo id="problemas" rot="Problemas encontrados (o que você fez, o que esperava, o que aconteceu)"><textarea id="problemas" value={f.problemas} onChange={muda("problemas")} /></Campo>
          <Campo id="sugestoes" rot="Sugestões"><textarea id="sugestoes" value={f.sugestoes} onChange={muda("sugestoes")} /></Campo>
        </Etapa>

        <Etapa num="08" titulo="Veredito" desc="Este aparelho está pronto para receber visitantes?">
          <div className="v-veredito" role="radiogroup" aria-label="Veredito">
            {VEREDITOS.map(([v, t, d]) => (
              <React.Fragment key={v}>
                <input type="radio" id={`v-${v}`} name="veredito" checked={f.veredito === v} onChange={() => setF((x) => ({ ...x, veredito: v }))} />
                <label htmlFor={`v-${v}`}><strong>{t}</strong><small>{d}</small></label>
              </React.Fragment>
            ))}
          </div>
        </Etapa>

        <div className="v-envio">
          <button type="submit" className="btn ouro">Salvar teste</button>
          <button type="button" className="btn" onClick={limpar}>Limpar formulário</button>
          <span className={`v-msg ${msg.tipo}`} role="status">{msg.texto}</span>
        </div>
      </form>

      <Historico testes={testes} setTestes={setTestes} />
    </main>
  );
}

function Etapa({ num, titulo, desc, children }) {
  return (
    <section className="v-etapa">
      <div className="v-etapa-cab"><span className="v-num">{num}</span><div><h2>{titulo}</h2><p>{desc}</p></div></div>
      {children}
    </section>
  );
}
const Campo = ({ id, rot, children }) => <div className="v-campo"><label htmlFor={id} className="v-rot">{rot}</label>{children}</div>;
const Opcoes = ({ id, valor, onChange, lista }) => (
  <select id={id} value={valor} onChange={onChange}>{lista.map((o) => <option key={o}>{o}</option>)}</select>
);
const Recurso = ({ nome, ok, falta, neutro }) => (
  <div><dt>{nome}</dt><dd className={ok ? "sim" : neutro ? "" : "nao"}>{ok ? "sim" : `não · ${falta}`}</dd></div>
);

// ---------- depois de salvar: mandar o resultado para quem consolida ----------
async function compartilharCSV(testes, nome) {
  const texto = paraCSV(testes);
  const arquivo = new File([texto], nome, { type: "text/csv" });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: "Validação CulturAR" }); return "Enviado."; }
    catch { return ""; }
  }
  baixarCSV(texto, nome);
  return "Arquivo CSV baixado.";
}
function baixarCSV(texto, nome) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copiarCSV(testes) {
  try { await navigator.clipboard.writeText(paraCSV(testes)); return "Copiado. Cole numa planilha."; }
  catch { return "O navegador bloqueou a cópia. Use Compartilhar."; }
}

function Enviado({ teste, todos, fechar }) {
  const [st, setSt] = useState("");
  const nome = `culturar-validacao-${teste.aparelho.replace(/\W+/g, "-").toLowerCase()}.csv`;
  return (
    <section className="v-enviado" role="status">
      <h2>Teste salvo neste aparelho</h2>
      <p>Agora mande o resultado para quem está consolidando a validação.</p>
      <div className="acoes">
        <button className="btn ouro" onClick={async () => setSt(await compartilharCSV([teste], nome))}>Compartilhar resultado</button>
        <button className="btn" onClick={async () => setSt(await copiarCSV([teste]))}>Copiar como CSV</button>
        <button className="btn" onClick={fechar}>Fechar</button>
      </div>
      {st && <p className="v-msg ok">{st}</p>}
      {todos.length > 1 && <p className="v-dica">Há {todos.length} testes salvos aqui. Para mandar todos juntos, use o histórico no fim da página.</p>}
    </section>
  );
}

function Historico({ testes, setTestes }) {
  const [st, setSt] = useState("");
  const [confirmar, setConfirmar] = useState(null);
  if (!testes.length) return null;
  const rotVeredito = Object.fromEntries(VEREDITOS.map(([v, t]) => [v, t]));
  return (
    <section className="v-etapa">
      <div className="v-cab-linha">
        <h2>Testes salvos neste aparelho</h2>
        <div className="acoes">
          <button className="btn" onClick={async () => setSt(await compartilharCSV(testes, "culturar-validacao.csv"))}>Compartilhar todos</button>
          <button className="btn" onClick={async () => setSt(await copiarCSV(testes))}>Copiar CSV</button>
        </div>
      </div>
      {st && <p className="v-msg ok">{st}</p>}
      <div className="v-tabela">
        <table>
          <thead><tr><th>Quando</th><th>Quem</th><th>Aparelho</th><th>Passou</th><th>Veredito</th><th /></tr></thead>
          <tbody>
            {testes.map((t) => {
              const rs = Object.values(t.itens || {}).filter((x) => x.r !== "na");
              const ok = rs.filter((x) => x.r === "ok").length;
              return (
                <tr key={t.id}>
                  <td className="n">{new Date(t.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{t.testador || "—"}{t.exemplo && <span className="v-chip exemplo">exemplo</span>}</td>
                  <td>{t.aparelho} · {t.navegador}</td>
                  <td className="n">{ok}/{rs.length}</td>
                  <td><span className={`v-chip ${t.veredito}`}>{rotVeredito[t.veredito]}</span></td>
                  <td>
                    {confirmar === t.id ? (
                      <span className="v-confirma">
                        <button className="v-link perigo" onClick={() => { setTestes(apagarTeste(t.id)); setConfirmar(null); }}>Apagar</button>
                        <button className="v-link" onClick={() => setConfirmar(null)}>Cancelar</button>
                      </span>
                    ) : (
                      <button className="v-link" onClick={() => setConfirmar(t.id)}>Apagar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
