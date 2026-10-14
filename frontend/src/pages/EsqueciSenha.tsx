import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Erro } from "../ui";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const r = await api<{ mensagem: string }>("/api/auth/esqueci-senha", { corpo: { email } });
      setMsg(r.mensagem);
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <div className="centro">
      <form className="cartao login" onSubmit={enviar}>
        <h1>Recuperar senha</h1>
        <Erro msg={erro} />
        {msg ? (
          <div className="alerta ok">{msg}</div>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="email">E-mail cadastrado</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="largo">Enviar link</button>
          </>
        )}
        <p className="pequeno"><Link to="/login">Voltar ao login</Link></p>
      </form>
    </div>
  );
}
