import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { api, DEMO, type StatusSolicitacao } from "./api";
import { confirmar } from "./dialogo";

// ------------------------------------------------------------------ formatação (America/Sao_Paulo)
const TZ = "America/Sao_Paulo";

export const fmtData = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
export const fmtHora = (h: string) => h.slice(0, 5);
export const fmtDataHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";
export const fmtPeriodo = (ini: string, fim: string) => (ini === fim ? fmtData(ini) : `${fmtData(ini)} a ${fmtData(fim)}`);
export const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

export function fmtDuracao(s: number | null) {
  if (s === null) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}min ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}min`;
}

export const STATUS_TEXTO: Record<StatusSolicitacao, string> = {
  EM_CONVOCACAO: "Em convocação",
  PREENCHIDA: "Preenchida",
  ESGOTADA: "Fila esgotada",
  CANCELADA: "Cancelada",
  EXPIRADA: "Expirada",
};

export function Badge({ status }: { status: string }) {
  const texto = STATUS_TEXTO[status as StatusSolicitacao] ?? status;
  return <span className={`badge badge-${status.toLowerCase()}`}>{texto}</span>;
}

// ------------------------------------------------------------------ hooks

/** Carrega dados e, opcionalmente, repete a cada `intervaloMs` (aba visível). */
export function useCarregar<T>(fn: () => Promise<T>, deps: unknown[], intervaloMs?: number) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const recarregar = useCallback(async () => {
    try {
      setDados(await fnRef.current());
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    setDados(null);
    recarregar();
    if (!intervaloMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, intervaloMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { dados, erro, recarregar, setDados };
}

// ------------------------------------------------------------------ layout

export function Layout({ children }: { children: ReactNode }) {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();
  const admin = usuario?.perfil === "admin";
  async function reiniciar() {
    if (!(await confirmar("Reiniciar a demonstração?", "Tudo o que você criou será apagado e os dados de exemplo voltam ao estado inicial.", { ok: "Reiniciar", perigo: true }))) return;
    await api("/api/demo/reiniciar", { corpo: {} });
    sair();
    navigate("/login");
  }

  return (
    <div className="app">
      {DEMO && (
        <div className="faixa-demo">
          <span>Modo demonstração: dados fictícios, sem servidor nem banco.</span>
          <button className="link" onClick={reiniciar}>Reiniciar dados</button>
        </div>
      )}
      <header className="topo">
        <div className="topo-linha">
          <strong className="marca">Substituições</strong>
          <span className="quem">
            {usuario?.nome}
            <button
              className="link"
              onClick={() => {
                sair();
                navigate("/login");
              }}
            >
              Sair
            </button>
          </span>
        </div>
        <nav className="menu">
          <NavLink to="/" end>Solicitações</NavLink>
          <NavLink to="/solicitacoes/nova">+ Nova</NavLink>
          {admin && (
            <>
              <NavLink to="/admin" end>Painel geral</NavLink>
              <NavLink to="/admin/escolas">Escolas</NavLink>
              <NavLink to="/admin/usuarios">Usuários</NavLink>
              <NavLink to="/admin/professores">Professores</NavLink>
              <NavLink to="/admin/listas">Classificação</NavLink>
              <NavLink to="/admin/configuracao">Regras</NavLink>
              <NavLink to="/admin/auditoria">Auditoria</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="conteudo">{children}</main>
    </div>
  );
}

export function Erro({ msg }: { msg: string | null }) {
  return msg ? <div className="alerta erro" role="alert">{msg}</div> : null;
}

export function Carregando() {
  return <p className="muted">Carregando…</p>;
}
