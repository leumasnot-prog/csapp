import { useState, type FormEvent } from "react";
import { api, type Escola, type Usuario } from "../../api";
import { Carregando, Erro, fmtDataHora, useCarregar } from "../../ui";

interface Form {
  id?: number;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  perfil: "admin" | "diretor";
  escola_ids: number[];
  ativo: boolean;
  senha: string;
}
const VAZIO: Form = { nome: "", email: "", cpf: "", telefone: "", perfil: "diretor", escola_ids: [], ativo: true, senha: "" };

export default function Usuarios() {
  const { dados, erro, recarregar } = useCarregar(() => api<Usuario[]>("/api/admin/usuarios"), []);
  const { dados: escolas } = useCarregar(() => api<Escola[]>("/api/admin/escolas"), []);
  const [form, setForm] = useState<Form>(VAZIO);
  const [msg, setMsg] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSenhaGerada(null);
    const corpo = { ...form, cpf: form.cpf || null, telefone: form.telefone || null, senha: form.senha || null };
    try {
      const r = await api<{ senha_provisoria?: string | null }>(form.id ? `/api/admin/usuarios/${form.id}` : "/api/admin/usuarios", {
        metodo: form.id ? "PUT" : "POST",
        corpo,
      });
      if (r.senha_provisoria) setSenhaGerada(`Senha provisória de ${form.email}: ${r.senha_provisoria} (exibida só agora)`);
      setForm(VAZIO);
      recarregar();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const alternarEscola = (id: number) =>
    setForm({ ...form, escola_ids: form.escola_ids.includes(id) ? form.escola_ids.filter((x) => x !== id) : [...form.escola_ids, id] });

  return (
    <>
      <h1>Usuários (Secretaria e diretores)</h1>
      {senhaGerada && <div className="alerta aviso">{senhaGerada}</div>}
      <form className="cartao" onSubmit={salvar}>
        <h2 style={{ marginTop: 0 }}>{form.id ? "Editar usuário" : "Novo usuário"}</h2>
        <Erro msg={msg} />
        <div className="grade">
          <div className="campo"><label>Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
          <div className="campo"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="campo"><label>{form.id ? "CPF (vazio = manter)" : "CPF (opcional, para login)"}</label><input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
          <div className="campo"><label>Telefone</label><input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
          <div className="campo">
            <label>Perfil</label>
            <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value as Form["perfil"] })}>
              <option value="diretor">Diretor(a)</option>
              <option value="admin">Secretaria (admin)</option>
            </select>
          </div>
          <div className="campo">
            <label>{form.id ? "Nova senha (opcional)" : "Senha (vazio = gerar provisória)"}</label>
            <input type="password" minLength={8} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} autoComplete="new-password" />
          </div>
        </div>
        {form.perfil === "diretor" && (
          <div className="campo">
            <label>Escolas vinculadas</label>
            <div className="linha">
              {escolas?.filter((e) => e.ativa).map((e) => (
                <label key={e.id} className="check">
                  <input type="checkbox" checked={form.escola_ids.includes(e.id)} onChange={() => alternarEscola(e.id)} /> {e.nome}
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="check campo">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo
        </label>
        <div className="linha">
          <button>Salvar</button>
          {form.id && <button type="button" className="secundario" onClick={() => setForm(VAZIO)}>Cancelar</button>}
        </div>
      </form>
      <Erro msg={erro} />
      {!dados ? <Carregando /> : (
        <div className="cartao tabela">
          <table>
            <thead><tr><th>Nome</th><th>Perfil</th><th className="esconder-mobile">Escolas</th><th className="esconder-mobile">Último acesso</th><th /></tr></thead>
            <tbody>
              {dados.map((u) => (
                <tr key={u.id} style={{ opacity: u.ativo ? 1 : 0.5 }}>
                  <td>{u.nome}<div className="muted pequeno">{u.email}</div></td>
                  <td>{u.perfil === "admin" ? "Secretaria" : "Diretor(a)"}</td>
                  <td className="esconder-mobile">{u.escolas.map((e) => e.nome).join(", ") || "—"}</td>
                  <td className="esconder-mobile">{fmtDataHora(u.ultimo_login_em ?? null)}</td>
                  <td>
                    <button
                      className="link"
                      onClick={() =>
                        setForm({ id: u.id, nome: u.nome, email: u.email, cpf: "", telefone: u.telefone ?? "", perfil: u.perfil, escola_ids: u.escolas.map((e) => e.id), ativo: u.ativo, senha: "" })
                      }
                    >
                      Editar
                    </button>
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
