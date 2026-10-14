import { useMemo, useState, type FormEvent } from "react";
import { api } from "../../api";
import { Carregando, Erro, fmtDataHora, useCarregar } from "../../ui";

interface Lista {
  id: number;
  nome: string;
  edital: string | null;
  ativa: boolean;
  arquivo_nome: string | null;
  arquivo_sha256: string | null;
  importada_em: string;
}
interface Problema { linha: number; campo: string; mensagem: string }
interface Resultado {
  ok: boolean;
  confirmado: boolean;
  total_linhas: number;
  erros: Problema[];
  avisos: Problema[];
  professores_novos: number;
  professores_atualizados: number;
  disciplinas_novas: string[];
  lista_id: number | null;
  previa: { posicao: number; nome: string; cpf_final: string; habilitacoes: string[]; novo: boolean }[];
}

const MODELO = "posicao;nome;cpf;email;telefone;habilitacoes\n1;Maria da Silva;123.456.789-09;maria@email.com;(16) 99999-0000;EF1:Polivalente | EI:Polivalente\n2;João Souza;987.654.321-00;;;EF2:Matemática\n";

export default function Listas() {
  const { dados, erro, recarregar } = useCarregar(() => api<Lista[]>("/api/admin/listas"), []);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [edital, setEdital] = useState("");
  const [ativar, setAtivar] = useState(true);
  const [res, setRes] = useState<Resultado | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(confirmar: boolean) {
    if (!arquivo) return;
    setMsg(null);
    setEnviando(true);
    const form = new FormData();
    form.append("arquivo", arquivo);
    form.append("nome", nome);
    if (edital) form.append("edital", edital);
    form.append("ativar", String(ativar));
    form.append("confirmar", String(confirmar));
    try {
      const r = await api<Resultado>("/api/admin/listas/importar", { form });
      setRes(r);
      if (r.confirmado) recarregar();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function ativarLista(id: number) {
    if (!window.confirm("Ativar esta lista? Novas solicitações passarão a usá-la.")) return;
    await api(`/api/admin/listas/${id}/ativar`, { corpo: {} });
    recarregar();
  }

  const modeloUrl = useMemo(() => URL.createObjectURL(new Blob(["\ufeff" + MODELO], { type: "text/csv" })), []);

  return (
    <>
      <h1>Lista de classificação</h1>
      <form
        className="cartao"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          enviar(false);
        }}
      >
        <h2 style={{ marginTop: 0 }}>Importar planilha (CSV ou XLSX)</h2>
        <p className="pequeno muted">
          Colunas: <code>posicao, nome, cpf, habilitacoes</code> (obrigatórias) e <code>email, telefone</code>. Habilitações no formato{" "}
          <code>ETAPA:Disciplina</code> separadas por <code>|</code>. Etapas: EI, EF1, EF2, EJA, EE.{" "}
          <a href={modeloUrl} download="modelo-classificacao.csv">Baixar modelo</a>
        </p>
        <Erro msg={msg} />
        <div className="grade">
          <div className="campo"><label>Nome da lista</label><input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} placeholder="PSS 2026 — PEB I" /></div>
          <div className="campo"><label>Edital</label><input value={edital} onChange={(e) => setEdital(e.target.value)} placeholder="01/2026" /></div>
          <div className="campo"><label>Arquivo</label><input type="file" accept=".csv,.xlsx" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setRes(null); }} required /></div>
        </div>
        <label className="check campo"><input type="checkbox" checked={ativar} onChange={(e) => setAtivar(e.target.checked)} /> Ativar ao importar (substitui a lista ativa)</label>
        <button disabled={enviando || !arquivo}>1. Validar e pré-visualizar</button>
      </form>

      {res && (
        <div className="cartao">
          {res.confirmado ? (
            <div className="alerta ok">✅ Importada: {res.total_linhas} linhas ({res.professores_novos} novos, {res.professores_atualizados} atualizados).</div>
          ) : res.ok ? (
            <div className="alerta info">
              Arquivo válido: {res.total_linhas} linhas · {res.professores_novos} professores novos · {res.professores_atualizados} já cadastrados (dados serão atualizados).
            </div>
          ) : (
            <div className="alerta erro">{res.erros.length} erro(s). Corrija a planilha e envie de novo: nada foi gravado.</div>
          )}
          {res.erros.length > 0 && (
            <div className="tabela">
              <table>
                <thead><tr><th>Linha</th><th>Campo</th><th>Erro</th></tr></thead>
                <tbody>{res.erros.map((e, i) => <tr key={i}><td>{e.linha || "—"}</td><td>{e.campo}</td><td>{e.mensagem}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {res.avisos.length > 0 && (
            <details className="campo">
              <summary>{res.avisos.length} aviso(s)</summary>
              <ul className="pequeno">{res.avisos.map((a, i) => <li key={i}>{a.linha ? `Linha ${a.linha}: ` : ""}{a.mensagem}</li>)}</ul>
            </details>
          )}
          {res.ok && !res.confirmado && (
            <>
              <div className="tabela">
                <table>
                  <thead><tr><th>Pos.</th><th>Nome</th><th>CPF</th><th>Habilitações</th></tr></thead>
                  <tbody>
                    {res.previa.map((p) => (
                      <tr key={p.posicao}>
                        <td>{p.posicao}º</td>
                        <td>{p.nome} {p.novo && <span className="badge badge-em_convocacao">novo</span>}</td>
                        <td>…{p.cpf_final}</td>
                        <td className="pequeno">{p.habilitacoes.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {res.total_linhas > res.previa.length && <p className="muted pequeno">Mostrando as {res.previa.length} primeiras linhas.</p>}
              <button onClick={() => enviar(true)} disabled={enviando}>2. Confirmar importação</button>
            </>
          )}
        </div>
      )}

      <h2>Listas importadas</h2>
      <Erro msg={erro} />
      {!dados ? <Carregando /> : (
        <div className="cartao tabela">
          <table>
            <thead><tr><th>Lista</th><th className="esconder-mobile">Arquivo</th><th>Importada</th><th /></tr></thead>
            <tbody>
              {dados.map((l) => (
                <tr key={l.id}>
                  <td>{l.nome} {l.edital && <span className="muted">· Edital {l.edital}</span>} {l.ativa && <span className="badge badge-preenchida">ativa</span>}</td>
                  <td className="esconder-mobile pequeno">{l.arquivo_nome}<div className="muted" title="SHA-256 do arquivo">{l.arquivo_sha256?.slice(0, 16)}…</div></td>
                  <td>{fmtDataHora(l.importada_em)}</td>
                  <td>{!l.ativa && <button className="link" onClick={() => ativarLista(l.id)}>Ativar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
