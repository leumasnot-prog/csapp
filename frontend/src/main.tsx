import { StrictMode, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { DEMO } from "./api";
import { Dialogos } from "./dialogo";
import { AuthProvider, useAuth } from "./auth";
import { Carregando, Layout } from "./ui";
import Login from "./pages/Login";
import EsqueciSenha from "./pages/EsqueciSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import Painel from "./pages/Painel";
import NovaSolicitacao from "./pages/NovaSolicitacao";
import Acompanhamento from "./pages/Acompanhamento";
import AdminPainel from "./pages/admin/AdminPainel";
import Escolas from "./pages/admin/Escolas";
import Usuarios from "./pages/admin/Usuarios";
import Professores from "./pages/admin/Professores";
import Listas from "./pages/admin/Listas";
import Configuracao from "./pages/admin/Configuracao";
import Auditoria from "./pages/admin/Auditoria";
import "./styles.css";

// Design system: página pública, carregada só quando aberta.
const DesignSystem = lazy(() => import("./ds/PaginaDesignSystem"));

function Protegida({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { usuario, carregando } = useAuth();
  const loc = useLocation();
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/login" state={{ de: loc.pathname }} replace />;
  if (admin && usuario.perfil !== "admin") return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/design-system" element={<Suspense fallback={<Carregando />}><DesignSystem /></Suspense>} />
      <Route path="/" element={<Protegida><Painel /></Protegida>} />
      <Route path="/solicitacoes/nova" element={<Protegida><NovaSolicitacao /></Protegida>} />
      <Route path="/solicitacoes/:id" element={<Protegida><Acompanhamento /></Protegida>} />
      <Route path="/admin" element={<Protegida admin><AdminPainel /></Protegida>} />
      <Route path="/admin/escolas" element={<Protegida admin><Escolas /></Protegida>} />
      <Route path="/admin/usuarios" element={<Protegida admin><Usuarios /></Protegida>} />
      <Route path="/admin/professores" element={<Protegida admin><Professores /></Protegida>} />
      <Route path="/admin/listas" element={<Protegida admin><Listas /></Protegida>} />
      <Route path="/admin/configuracao" element={<Protegida admin><Configuracao /></Protegida>} />
      <Route path="/admin/auditoria" element={<Protegida admin><Auditoria /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Na demonstração a navegação fica em memória: funciona aberta como arquivo
// local ou dentro de outra página.
// Na demonstração, o endereço "#/design-system" abre direto o design system.
// A variável VITE_ENTRADA gera uma demonstração que já abre numa rota específica.
const hashInicial = typeof window !== "undefined" ? window.location.hash : "";
const entradaDemo =
  import.meta.env.VITE_ENTRADA || (hashInicial === "#/design-system" || hashInicial === "#design-system" ? "/design-system" : "/");
const Router = DEMO
  ? ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[entradaDemo]}>{children}</MemoryRouter>
  : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <App />
        <Dialogos />
      </AuthProvider>
    </Router>
  </StrictMode>,
);
