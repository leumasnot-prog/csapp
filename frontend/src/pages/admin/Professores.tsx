import { useState, type FormEvent } from "react";
import { api, type Catalogo } from "../../api";
import { confirmar } from "../../dialogo";
import { Carregando, Erro, fmtDataHora, useCarregar } from "../../ui";

interface Professor {
  id: number;
  nome: string;
  cpf_mascarado: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  suspenso_ate: string | null;
  vinculado_bot: boolean;
  consentimento: boolean;
  bot_bloqueado: boolean;
  posicao: number | null;
  habilitacoes: { etapa: string; disciplina_id: number; disciplina: string }[];
}

interface Form {
  id?: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  ativo: boolean;
  suspenso_ate: string;
  habilitacoes: { etapa: string; disciplina_id: number }[];
}
const VAZIO: Form = { nome: "", cpf: "", email: "", telefone: "", ativo: true, suspenso_ate: "", habilitacoes: [] };

function situacaoBot(p: Professor) {
  if (p.bot_bloqueado) return "⛔ bloqueou o bot";
  if (!p.vinculado_bot) return "— não vinculado";
  if (!p.consentimento) return "⚠️ sem consentimento";
  return "✅ ativo no bot";
}

export default function Professores() {
  const [busca, setBusca] = useState("");
  const { dados, erro, recarregar } = useCarregar(
    () => api<Professor[]>(`/api/admin/professores${busca ? `?busca=${encodeURIComponent(busca)}` : ""}`),
    [busca],
  );
  const { dados: cat } = useCarregar(() => api<Catalogo>("/api/catalogo"), []);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<{ nome: string; codigo: string; expira_em: string; instrucoes: string } | null>(null);
  const [novaHab, setNovaHab] = useState({ etapa: "EF1", disciplina_id: "" });

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMsg(null);
    try {
      await api(form.id ? `/api/admin/professores/${form.id}` : "/api/admin/professores", {
        metodo: form.id ? "PUT" : "POST",
        corpo: { ...form, cpf: form.cpf || null, email: form.email || null, telefone: form.telefone || null, suspenso_ate: form.suspenso_ate || null },
      });
      setForm(null);
      recarregar();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function gerarCodigo(p: Professor) {
    if (!(await confirmar(`Gerar código de vínculo para ${p.nome}?`, "Um código gerado antes para este professor deixa de valer.", { ok: "Gerar código" }))) return;
    const r = await api<{ codigo: string; expira_em: string; instrucoes: string }>(`/api/admin/professores/${p.id}/codigo-vinculo`, { corpo: {} });
    setCodigo({ nome: p.nome, ...r });
  }

  return (
    <>
      <div className="linha entre">
        <h1>Professores substitutos</h1>
        <button onClick={() => setForm({ ...VAZIO })}>+ Novo</button>
      </div>
      {codigo && (
        <div className="cartao">
          <div className="muted pequeno">Código de vínculo de {codigo.nome} (exibido só agora; válido até {fmtDataHora(codigo.expira_em)})</div>
          <div className="codigo">{codigo.codigo}</div>
          <p className="pequeno">{codigo.instrucoes}</p>
          <button className="secundario" onClick={() => setCodigo(null)}>Fechar</button>
        </div>
      )}
      {form && (
        <form className="cartao" onSubmit={salvar}>
          <h2 style={{ marginTop: 0 }}>{form.id ? "Editar professor" : "Novo professor"}</h2>
          <Erro msg={msg} />
          <div className="grade">
            <div className="campo"><label>Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
            <div className="campo"><label>{form.id ? "CPF (vazio = manter)" : "CPF"}</label><input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} required={!form.id} /></div>
            <div className="campo"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="campo"><label>Telefone</label><input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <div className="campo"><label>Suspenso até</label><input type="date" value={form.suspenso_ate} onChange={(e) => setForm({ ...form, suspenso_ate: e.target.value })} /></div>
          </div>
          <label className="check campo"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
          <label>Habilitações</label>
          <div className="linha campo">
            {form.habilitacoes.map((h, i) => (
              <span key={i} className="badge badge-enviada">
                {h.etapa} · {cat?.disciplinas.find((d) => d.id === h.disciplina_id)?.nome}{" "}
                <button type="button" className="link" onClick={() => setForm({ ...form, habilitacoes: form.habilitacoes.filter((_, j) => j !== i) })}>×</button>
              </span>
            ))}
          </div>
          <div className="linha campo">
            <select style={{ width: "auto" }} value={novaHab.etapa} onChange={(e) => setNovaHab({ ...novaHab, etapa: e.target.value })}>
              {cat?.etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <select style={{ width: "auto" }} value={novaHab.disciplina_id} onChange={(e) => setNovaHab({ ...novaHab, disciplina_id: e.target.value })}>
              <option value="">Disciplina…</option>
              {cat?.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <button
              type="button"
              className="secundario"
              disabled={!novaHab.disciplina_id}
              onClick={() => setForm({ ...form, habilitacoes: [...form.habilitacoes, { etapa: novaHab.etapa, disciplina_id: Number(novaHab.disciplina_id) }] })}
            >
              Adicionar
            </button>
          </div>
          <div className="linha">
            <button>Salvar</button>
            <button type="button" className="secundario" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}
      <div className="campo" style={{ maxWidth: 360 }}>
        <input placeholder="Buscar por nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <Erro msg={erro} />
      {!dados ? <Carregando /> : (
        <div className="cartao tabela">
          <table>
            <thead><tr><th>Pos.</th><th>Nome</th><th className="esconder-mobile">Habilitações</th><th>Bot</th><th /></tr></thead>
            <tbody>
              {dados.map((p) => (
                <tr key={p.id} style={{ opacity: p.ativo ? 1 : 0.5 }}>
                  <td>{p.posicao ? `${p.posicao}º` : "—"}</td>
                  <td>
                    {p.nome}
                    <div className="muted pequeno">{p.cpf_mascarado}{p.suspenso_ate && ` · suspenso até ${p.suspenso_ate.split("-").reverse().join("/")}`}</div>
                  </td>
                  <td className="esconder-mobile pequeno">{p.habilitacoes.map((h) => `${h.etapa}/${h.disciplina}`).join(", ")}</td>
                  <td className="pequeno">{situacaoBot(p)}</td>
                  <td>
                    <div className="linha">
                      <button className="link" onClick={() => gerarCodigo(p)}>Código</button>
                      <button
                        className="link"
                        onClick={() =>
                          setForm({
                            id: p.id, nome: p.nome, cpf: "", email: p.email ?? "", telefone: p.telefone ?? "", ativo: p.ativo,
                            suspenso_ate: p.suspenso_ate ?? "", habilitacoes: p.habilitacoes.map(({ etapa, disciplina_id }) => ({ etapa, disciplina_id })),
                          })
                        }
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
