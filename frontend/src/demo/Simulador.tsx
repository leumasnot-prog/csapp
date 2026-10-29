// Só na demonstração: faz o papel dos professores, que no sistema real
// respondem pelos botões do Telegram.
import { useState } from "react";
import { api, type SolicitacaoDetalhe } from "../api";
import { fmtDataHora, fmtHora, fmtPeriodo } from "../ui";

type Extra = { etapa_nome?: string; turno_nome?: string };

export default function Simulador({ s, aoMudar }: { s: SolicitacaoDetalhe & Extra; aoMudar: (d?: SolicitacaoDetalhe) => void }) {
  const convs = s.ondas
    .filter((o) => o.ciclo === s.ciclo)
    .flatMap((o) => o.convocacoes.map((c) => ({ ...c, expira_em: o.expira_em })))
    .filter((c) => ["ENVIADA", "SEM_RESPOSTA", "VAGA_PREENCHIDA"].includes(c.status))
    .sort((a, b) => a.ordem - b.ordem);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [ocupado, setOcupado] = useState(false);

  const atual = convs.find((c) => c.id === escolhido) ?? convs.find((c) => c.status === "ENVIADA") ?? convs[0];
  if (!atual && s.status !== "EM_CONVOCACAO") return null;

  async function responder(resposta: "aceito" | "recuso") {
    if (!atual) return;
    setOcupado(true);
    try {
      const r = await api<{ mensagem: string }>("/api/demo/responder", { corpo: { convocacao_id: atual.id, resposta } });
      setRespostas({ ...respostas, [atual.id]: `${resposta === "aceito" ? "✅ Aceito" : "❌ Recuso"} → ${r.mensagem}` });
      aoMudar();
    } finally {
      setOcupado(false);
    }
  }

  async function encerrarPrazo() {
    setOcupado(true);
    try {
      aoMudar(await api<SolicitacaoDetalhe>("/api/demo/encerrar-prazo", { corpo: { solicitacao_id: s.id } }));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="cartao simulador" aria-labelledby="sim-titulo">
      <h2 id="sim-titulo">Celular dos professores <span className="selo-demo">simulação</span></h2>
      <p className="pequeno muted">
        Na demonstração, você responde no lugar dos professores. No sistema real, cada um recebe esta mensagem no Telegram e
        toca no botão.
      </p>
      {atual ? (
        <>
          <div className="campo">
            <label htmlFor="sim-prof">Professor</label>
            <select id="sim-prof" value={atual.id} onChange={(e) => setEscolhido(Number(e.target.value))}>
              {convs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.posicao}º {c.professor} — {c.status_texto}
                </option>
              ))}
            </select>
          </div>
          <div className="telefone">
            <div className="telefone-topo">Secretaria de Educação · bot</div>
            <div className="bolha">
              <strong>📣 Convocação para substituição</strong>
              <br />
              <br />
              🏫 {s.escola.nome}
              <br />📅 {fmtPeriodo(s.data_inicio, s.data_fim)}
              <br />🕒 {fmtHora(s.hora_inicio)}–{fmtHora(s.hora_fim)} ({s.turno_nome ?? s.turno})
              <br />📚 {s.disciplina} · {s.etapa_nome ?? s.etapa}
              <br />👥 Turma {s.turma}
              {s.observacoes && (
                <>
                  <br />📝 {s.observacoes}
                </>
              )}
              <br />
              <br />
              Responda até <strong>{fmtDataHora(atual.expira_em)}</strong>. A vaga fica com quem aceitar primeiro.
              <div className="bolha-botoes">
                <button type="button" disabled={ocupado} onClick={() => responder("aceito")}>✅ Aceito</button>
                <button type="button" disabled={ocupado} onClick={() => responder("recuso")}>❌ Recuso</button>
              </div>
            </div>
            {respostas[atual.id] && <div className="bolha bolha-resposta">{respostas[atual.id]}</div>}
          </div>
        </>
      ) : (
        <p className="pequeno">Nenhum professor com convocação em aberto neste momento.</p>
      )}
      {s.status === "EM_CONVOCACAO" && (
        <div className="linha" style={{ marginTop: ".75rem" }}>
          <button type="button" className="secundario" disabled={ocupado} onClick={encerrarPrazo}>
            Encerrar o prazo da onda agora
          </button>
          <span className="pequeno muted">Simula ninguém responder a tempo: a próxima onda sai na hora.</span>
        </div>
      )}
    </section>
  );
}
