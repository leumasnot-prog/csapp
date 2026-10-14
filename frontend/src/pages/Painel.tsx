import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type SolicitacaoResumo, type StatusSolicitacao } from "../api";
import { Badge, Carregando, Erro, STATUS_TEXTO, fmtDataHora, fmtHora, fmtPeriodo, useCarregar } from "../ui";

export default function Painel() {
  const [status, setStatus] = useState<string>("");
  const { dados, erro } = useCarregar(
    () => api<SolicitacaoResumo[]>(`/api/solicitacoes${status ? `?status=${status}` : ""}`),
    [status],
    10_000,
  );
  const ativas = dados?.filter((s) => s.status === "EM_CONVOCACAO") ?? [];

  return (
    <>
      <div className="linha entre">
        <h1>Solicitações</h1>
        <Link className="botao" to="/solicitacoes/nova">+ Nova solicitação</Link>
      </div>
      <Erro msg={erro} />
      {ativas.length > 0 && (
        <div className="alerta info">
          {ativas.length} solicitação(ões) em convocação agora. A página se atualiza sozinha.
        </div>
      )}
      <div className="campo" style={{ maxWidth: 260 }}>
        <label htmlFor="f">Filtrar por status</label>
        <select id="f" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {(Object.keys(STATUS_TEXTO) as StatusSolicitacao[]).map((s) => (
            <option key={s} value={s}>{STATUS_TEXTO[s]}</option>
          ))}
        </select>
      </div>
      {!dados ? (
        <Carregando />
      ) : dados.length === 0 ? (
        <p className="muted">Nenhuma solicitação encontrada.</p>
      ) : (
        <ul className="lista">
          {dados.map((s) => (
            <li key={s.id}>
              <Link className="item" to={`/solicitacoes/${s.id}`}>
                <div className="linha entre">
                  <span className="titulo">
                    {s.disciplina} · Turma {s.turma} {s.urgente && "⚡"}
                  </span>
                  <Badge status={s.status} />
                </div>
                <div className="muted pequeno">
                  {fmtPeriodo(s.data_inicio, s.data_fim)} · {fmtHora(s.hora_inicio)}–{fmtHora(s.hora_fim)} · {s.escola.nome}
                </div>
                <div className="pequeno">
                  {s.status === "EM_CONVOCACAO" && s.onda_atual && (
                    <>Onda {s.onda_atual} · responder até {fmtDataHora(s.expira_em)}</>
                  )}
                  {s.status === "PREENCHIDA" && <>✅ {s.professor_aceito}</>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
