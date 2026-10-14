import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Erro } from "../ui";

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (senha !== conf) return setErro("As senhas não conferem.");
    try {
      await api("/api/auth/redefinir-senha", { corpo: { token: params.get("token"), nova_senha: senha } });
      setOk(true);
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <div className="centro">
      <form className="cartao login" onSubmit={enviar}>
        <h1>Nova senha</h1>
        <Erro msg={erro} />
        {ok ? (
          <div className="alerta ok">Senha alterada. <Link to="/login">Entrar</Link></div>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="s1">Nova senha (mín. 8 caracteres)</label>
              <input id="s1" type="password" minLength={8} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div className="campo">
              <label htmlFor="s2">Confirme a senha</label>
              <input id="s2" type="password" minLength={8} autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} required />
            </div>
            <button className="largo">Salvar</button>
          </>
        )}
      </form>
    </div>
  );
}
