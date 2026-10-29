import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { DEMO } from "../api";
import { Erro } from "../ui";

export default function Login() {
  const { usuario, entrar } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { de?: string } };
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  async function enviar(e: FormEvent | null, credenciais?: [string, string]) {
    e?.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await entrar(...(credenciais ?? [login, senha]));
      navigate(loc.state?.de ?? "/", { replace: true });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="centro">
      <form className="cartao login" onSubmit={enviar}>
        <h1>Substituição de Professores</h1>
        <p className="muted pequeno">Secretaria Municipal de Educação</p>
        <Erro msg={erro} />
        <div className="campo">
          <label htmlFor="login">E-mail ou CPF</label>
          <input id="login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        <button className="largo" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        <p className="pequeno"><Link to="/esqueci-senha">Esqueci minha senha</Link></p>
        {DEMO && (
          <div className="demo-acesso">
            <strong>Demonstração</strong>
            <p className="pequeno muted">Dados fictícios, guardados só neste navegador. Entre com um perfil:</p>
            <div className="linha">
              <button type="button" className="secundario" disabled={enviando} onClick={() => enviar(null, ["diretor@exemplo.gov.br", "diretor12345"])}>
                Diretora (EMEF Monteiro Lobato)
              </button>
              <button type="button" className="secundario" disabled={enviando} onClick={() => enviar(null, ["admin@exemplo.gov.br", "admin12345"])}>
                Secretaria de Educação
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
