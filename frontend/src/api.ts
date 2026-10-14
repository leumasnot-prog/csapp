// Cliente HTTP mínimo da API.

const CHAVE_TOKEN = "subst.token";

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

export function token(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function salvarToken(t: string | null) {
  try {
    if (t) sessionStorage.setItem(CHAVE_TOKEN, t);
    else sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* modo privado: segue sem persistir */
  }
}

function mensagemDeErro(corpo: unknown, status: number): string {
  const d = (corpo as { detail?: unknown })?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    return d
      .map((e: { loc?: unknown[]; msg?: string }) => {
        const campo = (e.loc ?? []).slice(-1)[0];
        return campo ? `${campo}: ${e.msg}` : e.msg;
      })
      .join("; ");
  }
  return `Erro ${status}`;
}

export async function api<T = unknown>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let body: BodyInit | undefined;
  if (opcoes.form) body = opcoes.form;
  else if (opcoes.corpo !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opcoes.corpo);
  }
  const r = await fetch(caminho, { method: opcoes.metodo ?? (body ? "POST" : "GET"), headers, body });
  if (r.status === 401 && t) {
    salvarToken(null);
    window.dispatchEvent(new Event("sessao-expirada"));
  }
  const tipo = r.headers.get("content-type") ?? "";
  const corpo = tipo.includes("application/json") ? await r.json() : await r.text();
  if (!r.ok) throw new ErroApi(r.status, mensagemDeErro(corpo, r.status));
  return corpo as T;
}

/** Baixa um arquivo autenticado (CSV) e dispara o download no navegador. */
export async function baixar(caminho: string, nome: string) {
  const r = await fetch(caminho, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) throw new ErroApi(r.status, `Erro ${r.status}`);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------ tipos

export type Perfil = "admin" | "diretor";
export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  telefone?: string | null;
  escolas: { id: number; nome: string }[];
  ultimo_login_em?: string | null;
}
export interface Escola {
  id: number;
  nome: string;
  codigo_inep: string | null;
  endereco: string | null;
  telefone: string | null;
  ativa: boolean;
}
export type StatusSolicitacao = "EM_CONVOCACAO" | "PREENCHIDA" | "ESGOTADA" | "CANCELADA" | "EXPIRADA";
export interface SolicitacaoResumo {
  id: number;
  escola: { id: number; nome: string };
  disciplina: string;
  etapa: string;
  turma: string;
  turno: string;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string;
  hora_fim: string;
  urgente: boolean;
  status: StatusSolicitacao;
  ciclo: number;
  criada_em: string;
  preenchida_em: string | null;
  professor_aceito: string | null;
  onda_atual: number | null;
  expira_em: string | null;
}
export interface Convocacao {
  id: number;
  professor: string;
  posicao: number;
  ordem: number;
  status: string;
  status_texto: string;
  criada_em: string;
  enviada_em: string | null;
  respondida_em: string | null;
  tempo_resposta_s: number | null;
}
export interface Onda {
  id: number;
  ciclo: number;
  numero: number;
  iniciada_em: string;
  expira_em: string;
  encerrada_em: string | null;
  motivo_encerramento: string | null;
  convocacoes: Convocacao[];
  pulos: { professor: string; posicao: number; ordem: number; motivo: string; motivo_texto: string }[];
}
export interface SolicitacaoDetalhe extends SolicitacaoResumo {
  motivo: string | null;
  observacoes: string | null;
  timeout_minutos: number;
  motivo_cancelamento: string | null;
  encerrada_em: string | null;
  criada_por: string;
  contato_professor: { nome: string; telefone: string | null; email: string | null } | null;
  ondas: Onda[];
}
export interface Catalogo {
  disciplinas: { id: number; nome: string }[];
  etapas: { id: string; nome: string }[];
  turnos: { id: string; nome: string }[];
}
