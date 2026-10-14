import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, salvarToken, token, type Usuario } from "./api";

interface Sessao {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (login: string, senha: string) => Promise<void>;
  sair: () => void;
}

const Ctx = createContext<Sessao>(null as unknown as Sessao);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!token()) {
      setCarregando(false);
      return;
    }
    api<Usuario>("/api/auth/me")
      .then(setUsuario)
      .catch(() => salvarToken(null))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    const expirou = () => setUsuario(null);
    window.addEventListener("sessao-expirada", expirou);
    return () => window.removeEventListener("sessao-expirada", expirou);
  }, []);

  const entrar = useCallback(async (login: string, senha: string) => {
    const r = await api<{ access_token: string; usuario: Usuario }>("/api/auth/login", {
      corpo: { login, senha },
    });
    salvarToken(r.access_token);
    setUsuario(r.usuario);
  }, []);

  const sair = useCallback(() => {
    salvarToken(null);
    setUsuario(null);
  }, []);

  return <Ctx.Provider value={{ usuario, carregando, entrar, sair }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
