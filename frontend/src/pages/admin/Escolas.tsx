import { useState, type FormEvent } from "react";
import { api, type Escola } from "../../api";
import { Carregando, Erro, useCarregar } from "../../ui";

const VAZIA = { nome: "", codigo_inep: "", endereco: "", telefone: "", ativa: true };

export default function Escolas() {
  const { dados, erro, recarregar } = useCarregar(() => api<Escola[]>("/api/admin/escolas"), []);
  const [form, setForm] = useState<typeof VAZIA & { id?: number }>(VAZIA);
  const [msg, setMsg] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const corpo = { ...form, codigo_inep: form.codigo_inep || null, endereco: form.endereco || null, telefone: form.telefone || null };
    try {
      await api(form.id ? `/api/admin/escolas/${form.id}` : "/api/admin/escolas", { metodo: form.id ? "PUT" : "POST", corpo });
      setForm(VAZIA);
      recarregar();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const set = (k: keyof typeof VAZIA) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <h1>Escolas</h1>
      <form className="cartao" onSubmit={salvar}>
        <h2 style={{ marginTop: 0 }}>{form.id ? "Editar escola" : "Nova escola"}</h2>
        <Erro msg={msg} />
        <div className="grade">
          <div className="campo"><label>Nome</label><input value={form.nome} onChange={set("nome")} required minLength={3} /></div>
          <div className="campo"><label>Código INEP</label><input value={form.codigo_inep ?? ""} onChange={set("codigo_inep")} /></div>
          <div className="campo"><label>Endereço</label><input value={form.endereco ?? ""} onChange={set("endereco")} /></div>
          <div className="campo"><label>Telefone</label><input value={form.telefone ?? ""} onChange={set("telefone")} /></div>
        </div>
        <label className="check campo">
          <input type="checkbox" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} /> Ativa
        </label>
        <div className="linha">
          <button>Salvar</button>
          {form.id && <button type="button" className="secundario" onClick={() => setForm(VAZIA)}>Cancelar</button>}
        </div>
      </form>
      <Erro msg={erro} />
      {!dados ? <Carregando /> : (
        <div className="cartao tabela">
          <table>
            <thead><tr><th>Nome</th><th className="esconder-mobile">INEP</th><th className="esconder-mobile">Telefone</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {dados.map((e) => (
                <tr key={e.id}>
                  <td>{e.nome}</td>
                  <td className="esconder-mobile">{e.codigo_inep ?? "—"}</td>
                  <td className="esconder-mobile">{e.telefone ?? "—"}</td>
                  <td>{e.ativa ? "Ativa" : "Inativa"}</td>
                  <td><button className="link" onClick={() => setForm({ ...VAZIA, ...e, codigo_inep: e.codigo_inep ?? "", endereco: e.endereco ?? "", telefone: e.telefone ?? "" })}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
