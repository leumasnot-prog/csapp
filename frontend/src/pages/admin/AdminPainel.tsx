import { useState } from "react";
import { Link } from "react-router-dom";
import { api, baixar, type Escola, type SolicitacaoResumo, type StatusSolicitacao } from "../../api";
import { Badge, Carregando, Erro, STATUS_TEXTO, fmtHora, fmtPeriodo, useCarregar } from "../../ui";

interface Indicadores {
  total: number;
  por_status: Record<string, number>;
  taxa_preenchimento: number | null;
  tempo_medio_preenchimento_min: number | null;
  taxa_aceite_por_convocacao: number | null;
  por_escola: Record<string, number>;
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export default function AdminPainel() {
  const [filtro, setFiltro] = useState({ escola_id: "", status: "", inicio: "", fim: "" });
  const qs = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString();
  const { dados: escolas } = useCarregar(() => api<Escola[]>("/api/admin/escolas"), []);
  const { dados, erro } = useCarregar(
    () => api<{ indicadores: Indicadores; solicitacoes: SolicitacaoResumo[] }>(`/api/admin/painel?${qs}`),
    [qs],
    15_000,
  );
  const set = (k: keyof typeof filtro) => (e: { target: { value: string } }) => setFiltro({ ...filtro, [k]: e.target.value });
  const ind = dados?.indicadores;

  return (
    <>
      <h1>Painel geral</h1>
      <div className="cartao grade">
        <div>
          <label htmlFor="e">Escola</label>
          <select id="e" value={filtro.escola_id} onChange={set("escola_id")}>
            <option value="">Todas</option>
            {escolas?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="s">Status</label>
          <select id="s" value={filtro.status} onChange={set("status")}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_TEXTO) as StatusSolicitacao[]).map((s) => <option key={s} value={s}>{STATUS_TEXTO[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="i">De</label>
          <input id="i" type="date" value={filtro.inicio} onChange={set("inicio")} />
        </div>
        <div>
          <label htmlFor="f">Até</label>
          <input id="f" type="date" value={filtro.fim} onChange={set("fim")} />
        </div>
      </div>
      <Erro msg={erro} />
      {!ind ? (
        <Carregando />
      ) : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="valor">{ind.total}</div><div className="rotulo">solicitações</div></div>
            <div className="kpi"><div className="valor">{ind.por_status.EM_CONVOCACAO ?? 0}</div><div className="rotulo">em convocação</div></div>
            <div className="kpi"><div className="valor">{pct(ind.taxa_preenchimento)}</div><div className="rotulo">preenchidas (das encerradas)</div></div>
            <div className="kpi"><div className="valor">{ind.tempo_medio_preenchimento_min ?? "—"}</div><div className="rotulo">min até preencher (média)</div></div>
            <div className="kpi"><div className="valor">{ind.por_status.ESGOTADA ?? 0}</div><div className="rotulo">filas esgotadas</div></div>
            <div className="kpi"><div className="valor">{pct(ind.taxa_aceite_por_convocacao)}</div><div className="rotulo">aceite por convocação</div></div>
          </div>
          <div className="linha entre">
            <h2>Solicitações</h2>
            <button className="secundario" onClick={() => baixar(`/api/admin/relatorios/solicitacoes.csv?${qs}`, "solicitacoes.csv")}>
              Exportar CSV
            </button>
          </div>
          <div className="cartao tabela">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Escola</th><th>Vaga</th><th className="esconder-mobile">Período</th><th>Status</th><th className="esconder-mobile">Professor</th>
                </tr>
              </thead>
              <tbody>
                {dados!.solicitacoes.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/solicitacoes/${s.id}`}>{s.id}</Link></td>
                    <td>{s.escola.nome}</td>
                    <td>{s.disciplina} · {s.etapa} · {s.turma}</td>
                    <td className="esconder-mobile">{fmtPeriodo(s.data_inicio, s.data_fim)} {fmtHora(s.hora_inicio)}–{fmtHora(s.hora_fim)}</td>
                    <td><Badge status={s.status} /></td>
                    <td className="esconder-mobile">{s.professor_aceito ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
