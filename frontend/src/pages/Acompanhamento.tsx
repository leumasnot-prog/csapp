import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, baixar, type SolicitacaoDetalhe } from "../api";
import { Badge, Carregando, Erro, fmtDataHora, fmtDuracao, fmtHora, fmtPeriodo, useCarregar } from "../ui";

const FIM_ONDA: Record<string, string> = {
  ACEITE: "vaga preenchida",
  TIMEOUT: "prazo esgotado",
  TODOS_RECUSARAM: "todos recusaram",
  CANCELADA: "cancelada",
  EXPIRADA: "período encerrado",
};

export default function Acompanhamento() {
  const { id } = useParams();
  const { dados: s, erro, setDados } = useCarregar(
    () => api<SolicitacaoDetalhe>(`/api/solicitacoes/${id}`),
    [id],
    5_000,
  );
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function acao(caminho: string, corpo?: unknown) {
    setAcaoErro(null);
    setOcupado(true);
    try {
      setDados(await api<SolicitacaoDetalhe>(caminho, { corpo: corpo ?? {} }));
    } catch (e) {
      setAcaoErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (erro && !s) return <Erro msg={erro} />;
  if (!s) return <Carregando />;

  const podeCancelar = ["EM_CONVOCACAO", "PREENCHIDA", "ESGOTADA"].includes(s.status);
  const podeReabrir = ["CANCELADA", "ESGOTADA", "EXPIRADA"].includes(s.status);

  return (
    <>
      <p className="pequeno"><Link to="/">← Solicitações</Link></p>
      <div className="cartao">
        <div className="linha entre">
          <h1 style={{ margin: 0 }}>
            {s.disciplina} · Turma {s.turma} {s.urgente && "⚡"}
          </h1>
          <Badge status={s.status} />
        </div>
        <p className="muted">
          {s.escola.nome} · {fmtPeriodo(s.data_inicio, s.data_fim)} · {fmtHora(s.hora_inicio)}–{fmtHora(s.hora_fim)}
          <br />
          Criada por {s.criada_por} em {fmtDataHora(s.criada_em)} · prazo por onda: {s.timeout_minutos} min
          {s.ciclo > 1 && <> · reaberta ({s.ciclo}º ciclo)</>}
        </p>
        {s.observacoes && <p className="pequeno">📝 {s.observacoes}</p>}

        {s.status === "EM_CONVOCACAO" && (
          <div className="alerta info">
            ⏳ Onda {s.onda_atual} em andamento. Resposta até {fmtDataHora(s.expira_em)}. Atualiza a cada 5 s.
          </div>
        )}
        {s.contato_professor && (
          <div className="alerta ok">
            ✅ <strong>{s.contato_professor.nome}</strong> aceitou a substituição.
            <br />
            {s.contato_professor.telefone && (
              <a href={`tel:${s.contato_professor.telefone}`}>📞 {s.contato_professor.telefone}</a>
            )}{" "}
            {s.contato_professor.email && <a href={`mailto:${s.contato_professor.email}`}>✉️ {s.contato_professor.email}</a>}
          </div>
        )}
        {s.status === "ESGOTADA" && (
          <div className="alerta erro">
            A fila de classificação acabou sem aceite. A Secretaria foi avisada. Você pode reabrir (recomeça do topo).
          </div>
        )}
        {s.status === "CANCELADA" && s.motivo_cancelamento && (
          <div className="alerta aviso">Cancelada: {s.motivo_cancelamento}</div>
        )}
        <Erro msg={acaoErro} />
        <div className="linha">
          {podeCancelar && (
            <button
              className="perigo"
              disabled={ocupado}
              onClick={() => {
                const motivo = window.prompt(
                  s.status === "PREENCHIDA"
                    ? "Cancelar? O professor que aceitou será avisado. Motivo (opcional):"
                    : "Cancelar a convocação? Motivo (opcional):",
                );
                if (motivo !== null) acao(`/api/solicitacoes/${s.id}/cancelar`, { motivo });
              }}
            >
              Cancelar
            </button>
          )}
          {podeReabrir && (
            <button className="secundario" disabled={ocupado} onClick={() => acao(`/api/solicitacoes/${s.id}/reabrir`)}>
              Reabrir
            </button>
          )}
          <button
            className="secundario"
            onClick={() => baixar(`/api/solicitacoes/${s.id}/comprovacao?formato=csv`, `comprovacao-${s.id}.csv`)}
          >
            Comprovação da ordem (CSV)
          </button>
        </div>
      </div>

      <h2>Convocações</h2>
      {s.ondas.length === 0 && <p className="muted">Nenhuma onda disparada.</p>}
      {s.ondas.map((o) => (
        <div key={o.id} className={`cartao onda ${o.encerrada_em ? "" : "aberta"}`}>
          <div className="linha entre">
            <strong>
              {s.ciclo > 1 && `Ciclo ${o.ciclo} · `}Onda {o.numero}
            </strong>
            <span className="muted pequeno">
              {fmtDataHora(o.iniciada_em)}
              {o.encerrada_em ? ` · encerrada: ${FIM_ONDA[o.motivo_encerramento ?? ""] ?? ""}` : ` · até ${fmtDataHora(o.expira_em)}`}
            </span>
          </div>
          {o.convocacoes.map((c) => (
            <div key={c.id} className="pessoa">
              <span>
                <strong>{c.posicao}º</strong> {c.professor}
                <span className="muted pequeno">
                  {c.respondida_em && ` · respondeu em ${fmtDuracao(c.tempo_resposta_s)}`}
                  {!c.enviada_em && c.status === "ENVIADA" && " · enviando…"}
                </span>
              </span>
              <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status_texto}</span>
            </div>
          ))}
          {o.pulos.length > 0 && (
            <details className="pequeno">
              <summary className="muted">{o.pulos.length} pulado(s) por indisponibilidade</summary>
              {o.pulos.map((p) => (
                <div key={`${p.ordem}-${p.professor}`} className="muted">
                  {p.posicao}º {p.professor}: {p.motivo_texto}
                </div>
              ))}
            </details>
          )}
        </div>
      ))}
    </>
  );
}
