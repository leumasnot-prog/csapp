import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Catalogo, type Escola, type SolicitacaoDetalhe } from "../api";
import { Carregando, Erro, hojeSP, useCarregar } from "../ui";

const HORARIOS: Record<string, [string, string]> = {
  MANHA: ["07:00", "11:30"],
  TARDE: ["13:00", "17:30"],
  NOITE: ["19:00", "22:30"],
  INTEGRAL: ["07:30", "16:30"],
};

export default function NovaSolicitacao() {
  const navigate = useNavigate();
  const { dados: escolas } = useCarregar(() => api<Escola[]>("/api/escolas"), []);
  const { dados: cat } = useCarregar(() => api<Catalogo>("/api/catalogo"), []);
  const hoje = hojeSP();
  const [f, setF] = useState({
    escola_id: "",
    etapa: "EF1",
    disciplina_id: "",
    turma: "",
    turno: "MANHA",
    data_inicio: hoje,
    data_fim: hoje,
    hora_inicio: HORARIOS.MANHA[0],
    hora_fim: HORARIOS.MANHA[1],
    motivo: "",
    observacoes: "",
    urgente: false,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (escolas?.length && !f.escola_id) setF((x) => ({ ...x, escola_id: String(escolas[0].id) }));
  }, [escolas, f.escola_id]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await api<SolicitacaoDetalhe>("/api/solicitacoes", {
        corpo: {
          ...f,
          escola_id: Number(f.escola_id),
          disciplina_id: Number(f.disciplina_id),
          data_fim: f.data_fim < f.data_inicio ? f.data_inicio : f.data_fim,
          motivo: f.motivo || null,
          observacoes: f.observacoes || null,
        },
      });
      navigate(`/solicitacoes/${r.id}`);
    } catch (err) {
      setErro((err as Error).message);
      setEnviando(false);
    }
  }

  if (!escolas || !cat) return <Carregando />;

  return (
    <form className="cartao" onSubmit={enviar} style={{ maxWidth: 720 }}>
      <h1>Nova solicitação de substituição</h1>
      <Erro msg={erro} />
      {escolas.length > 1 && (
        <div className="campo">
          <label htmlFor="escola">Escola</label>
          <select id="escola" value={f.escola_id} onChange={set("escola_id")} required>
            {escolas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      )}
      <div className="grade">
        <div className="campo">
          <label htmlFor="etapa">Etapa</label>
          <select id="etapa" value={f.etapa} onChange={set("etapa")}>
            {cat.etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="disc">Disciplina</label>
          <select id="disc" value={f.disciplina_id} onChange={set("disciplina_id")} required>
            <option value="">Selecione…</option>
            {cat.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="turma">Turma</label>
          <input id="turma" placeholder="ex.: 3º A" value={f.turma} onChange={set("turma")} required maxLength={50} />
        </div>
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="di">Data inicial</label>
          <input id="di" type="date" min={hoje} value={f.data_inicio} onChange={set("data_inicio")} required />
        </div>
        <div className="campo">
          <label htmlFor="df">Data final</label>
          <input id="df" type="date" min={f.data_inicio} value={f.data_fim < f.data_inicio ? f.data_inicio : f.data_fim} onChange={set("data_fim")} required />
        </div>
        <div className="campo">
          <label htmlFor="turno">Turno</label>
          <select
            id="turno"
            value={f.turno}
            onChange={(e) => {
              const [hi, hf] = HORARIOS[e.target.value];
              setF({ ...f, turno: e.target.value, hora_inicio: hi, hora_fim: hf });
            }}
          >
            {cat.turnos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="hi">Das</label>
          <input id="hi" type="time" value={f.hora_inicio} onChange={set("hora_inicio")} required />
        </div>
        <div className="campo">
          <label htmlFor="hf">Até</label>
          <input id="hf" type="time" value={f.hora_fim} onChange={set("hora_fim")} required />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="motivo">Motivo (opcional, não é enviado ao professor)</label>
        <input id="motivo" value={f.motivo} onChange={set("motivo")} maxLength={300} placeholder="ex.: licença médica" />
      </div>
      <div className="campo">
        <label htmlFor="obs">Observações para o professor (opcional)</label>
        <textarea id="obs" value={f.observacoes} onChange={set("observacoes")} maxLength={2000} placeholder="ex.: plano de aula na coordenação" />
      </div>
      <div className="campo">
        <label className="check">
          <input type="checkbox" checked={f.urgente} onChange={(e) => setF({ ...f, urgente: e.target.checked })} />
          Urgente: prazo de resposta menor em cada onda
        </label>
      </div>
      <p className="muted pequeno">
        Ao enviar, os 3 primeiros professores habilitados e disponíveis na classificação recebem a convocação no Telegram.
        O primeiro que aceitar fica com a vaga.
      </p>
      <button className="largo" disabled={enviando}>{enviando ? "Enviando…" : "Enviar convocação"}</button>
    </form>
  );
}
