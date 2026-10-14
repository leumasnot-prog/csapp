import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { Carregando, Erro, useCarregar } from "../../ui";

interface Config {
  tamanho_onda: number;
  timeout_minutos: number;
  timeout_minutos_urgente: number;
  aceitar_resposta_tardia: boolean;
  politica_recusa: string;
  dias_suspensao_recusa: number;
  politica_sem_resposta: string;
  dias_suspensao_sem_resposta: number;
  exclusividade_no_periodo: boolean;
  max_substituicoes_simultaneas: number | null;
  carga_horaria_max_semanal: number | null;
}

const POLITICAS = [
  { id: "MANTER", nome: "Mantém a posição" },
  { id: "FIM_DA_LISTA", nome: "Vai para o fim da lista" },
  { id: "SUSPENDER", nome: "Suspensão por N dias" },
];

export default function Configuracao() {
  const { dados, erro, setDados } = useCarregar(() => api<Config>("/api/admin/configuracao"), []);
  const [msg, setMsg] = useState<{ tipo: string; texto: string } | null>(null);

  if (!dados) return erro ? <Erro msg={erro} /> : <Carregando />;
  const c = dados;
  const num = (k: keyof Config, opcional = false) => (e: { target: { value: string } }) =>
    setDados({ ...c, [k]: e.target.value === "" && opcional ? null : Number(e.target.value) });

  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      setDados(await api<Config>("/api/admin/configuracao", { metodo: "PUT", corpo: c }));
      setMsg({ tipo: "ok", texto: "Regras salvas. Valem para as próximas ondas e solicitações." });
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    }
  }

  return (
    <form className="cartao" onSubmit={salvar} style={{ maxWidth: 760 }}>
      <h1>Regras de convocação</h1>
      <p className="muted pequeno">Ajuste conforme o edital e a legislação municipal. Toda alteração fica registrada na auditoria.</p>
      {msg && <div className={`alerta ${msg.tipo}`}>{msg.texto}</div>}

      <h2>Ondas</h2>
      <div className="grade">
        <div className="campo"><label>Professores por onda</label><input type="number" min={1} max={20} value={c.tamanho_onda} onChange={num("tamanho_onda")} /></div>
        <div className="campo"><label>Prazo de resposta (min)</label><input type="number" min={1} value={c.timeout_minutos} onChange={num("timeout_minutos")} /></div>
        <div className="campo"><label>Prazo se urgente (min)</label><input type="number" min={1} value={c.timeout_minutos_urgente} onChange={num("timeout_minutos_urgente")} /></div>
      </div>
      <label className="check campo">
        <input type="checkbox" checked={c.aceitar_resposta_tardia} onChange={(e) => setDados({ ...c, aceitar_resposta_tardia: e.target.checked })} />
        Aceitar resposta após o prazo da onda, se a vaga ainda estiver aberta
      </label>

      <h2>Penalidades</h2>
      <div className="grade">
        <div className="campo">
          <label>Quem recusa</label>
          <select value={c.politica_recusa} onChange={(e) => setDados({ ...c, politica_recusa: e.target.value })}>
            {POLITICAS.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        {c.politica_recusa === "SUSPENDER" && (
          <div className="campo"><label>Dias de suspensão (recusa)</label><input type="number" min={0} value={c.dias_suspensao_recusa} onChange={num("dias_suspensao_recusa")} /></div>
        )}
        <div className="campo">
          <label>Quem não responde</label>
          <select value={c.politica_sem_resposta} onChange={(e) => setDados({ ...c, politica_sem_resposta: e.target.value })}>
            {POLITICAS.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        {c.politica_sem_resposta === "SUSPENDER" && (
          <div className="campo"><label>Dias de suspensão (sem resposta)</label><input type="number" min={0} value={c.dias_suspensao_sem_resposta} onChange={num("dias_suspensao_sem_resposta")} /></div>
        )}
      </div>
      <p className="muted pequeno">A penalidade por falta de resposta só é aplicada quando a solicitação é encerrada (nunca em cancelamento).</p>

      <h2>Disponibilidade</h2>
      <label className="check campo">
        <input type="checkbox" checked={c.exclusividade_no_periodo} onChange={(e) => setDados({ ...c, exclusividade_no_periodo: e.target.checked })} />
        Quem já está em substituição no período fica indisponível, mesmo em outro horário
      </label>
      <div className="grade">
        <div className="campo"><label>Máx. substituições simultâneas (vazio = sem limite)</label><input type="number" min={1} value={c.max_substituicoes_simultaneas ?? ""} onChange={num("max_substituicoes_simultaneas", true)} /></div>
        <div className="campo"><label>Carga horária máx. semanal em h (vazio = sem limite)</label><input type="number" min={1} value={c.carga_horaria_max_semanal ?? ""} onChange={num("carga_horaria_max_semanal", true)} /></div>
      </div>
      <button>Salvar regras</button>
    </form>
  );
}
