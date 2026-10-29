// Servidor de demonstração: implementa no navegador as mesmas rotas e regras da
// API real (backend/app/services/motor.py), com dados fictícios em memória.
// Usado somente quando o painel é compilado com VITE_DEMO=1.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ErroApi, token } from "../api";

type Etapa = "EI" | "EF1" | "EF2" | "EJA" | "EE";
type StatusSol = "EM_CONVOCACAO" | "PREENCHIDA" | "ESGOTADA" | "CANCELADA" | "EXPIRADA";
type StatusConv =
  | "ENVIADA" | "ACEITA" | "RECUSADA" | "SEM_RESPOSTA" | "VAGA_PREENCHIDA" | "CANCELADA" | "FALHA_ENVIO" | "INELEGIVEL";
type Politica = "MANTER" | "FIM_DA_LISTA" | "SUSPENDER";

interface Escola { id: number; nome: string; codigo_inep: string | null; endereco: string | null; telefone: string | null; ativa: boolean }
interface Usr { id: number; nome: string; email: string; cpf: string | null; telefone: string | null; perfil: "admin" | "diretor"; ativo: boolean; escola_ids: number[]; senha: string; ultimo_login_em: string | null }
interface Prof {
  id: number; nome: string; cpf: string; email: string | null; telefone: string | null; ativo: boolean; suspenso_ate: string | null;
  vinculado: boolean; consentimento: boolean; bloqueado: boolean;
  habs: { etapa: Etapa; disciplina_id: number }[]; indisp: { ini: string; fim: string; motivo: string | null }[];
}
interface Lista { id: number; nome: string; edital: string | null; ativa: boolean; arquivo_nome: string | null; arquivo_sha256: string | null; importada_em: string }
interface Classif { lista_id: number; professor_id: number; posicao: number; rebaixado_em: string | null }
interface Conv { id: number; professor_id: number; posicao: number; ordem: number; ciclo: number; status: StatusConv; criada_em: string; enviada_em: string | null; respondida_em: string | null; tempo_resposta_s: number | null }
interface Pulo { professor_id: number; posicao: number; ordem: number; motivo: string }
interface Onda { id: number; ciclo: number; numero: number; iniciada_em: string; expira_em: string; encerrada_em: string | null; motivo_encerramento: string | null; convocacoes: Conv[]; pulos: Pulo[] }
interface Sol {
  id: number; escola_id: number; criada_por_id: number; lista_id: number; disciplina_id: number; etapa: Etapa; turma: string; turno: string;
  data_inicio: string; data_fim: string; hora_inicio: string; hora_fim: string; motivo: string | null; observacoes: string | null;
  urgente: boolean; timeout_minutos: number; status: StatusSol; ciclo: number; professor_aceito_id: number | null;
  preenchida_em: string | null; encerrada_em: string | null; motivo_cancelamento: string | null; criada_em: string; ondas: Onda[];
}
interface Config {
  tamanho_onda: number; timeout_minutos: number; timeout_minutos_urgente: number; aceitar_resposta_tardia: boolean;
  politica_recusa: Politica; dias_suspensao_recusa: number; politica_sem_resposta: Politica; dias_suspensao_sem_resposta: number;
  exclusividade_no_periodo: boolean; max_substituicoes_simultaneas: number | null; carga_horaria_max_semanal: number | null;
}
interface Reg { id: number; ocorrido_em: string; ator_tipo: string; ator_id: number | null; acao: string; entidade: string; entidade_id: number | null; escola_id: number | null; dados: any; ip: string; hash_anterior: string; hash: string }
interface Estado {
  versao: number; seq: number; escolas: Escola[]; usuarios: Usr[]; disciplinas: { id: number; nome: string }[];
  profs: Prof[]; listas: Lista[]; classif: Classif[]; config: Config; sols: Sol[]; log: Reg[];
}

const CHAVE = "subst.demo.v1";
const VERSAO = 1;
const ETAPAS: Record<Etapa, string> = {
  EI: "Educação Infantil", EF1: "Fundamental - Anos Iniciais", EF2: "Fundamental - Anos Finais", EJA: "EJA", EE: "Educação Especial",
};
const TURNOS: Record<string, string> = { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite", INTEGRAL: "Integral" };
const MOTIVO_PULO: Record<string, string> = {
  INATIVO: "cadastro inativo", SEM_VINCULO_BOT: "não vinculado ao bot", SEM_CONSENTIMENTO: "sem consentimento LGPD",
  BOT_BLOQUEADO: "bloqueou o bot", SUSPENSO: "suspenso", INDISPONIVEL: "declarou indisponibilidade",
  CONFLITO_HORARIO: "já em substituição no horário", SUBSTITUICAO_NO_PERIODO: "já em substituição no período",
  LIMITE_SIMULTANEAS: "limite de substituições simultâneas", CARGA_HORARIA: "carga horária semanal máxima",
};
const STATUS_CONV: Record<StatusConv, string> = {
  ENVIADA: "Aguardando resposta", ACEITA: "Aceitou", RECUSADA: "Recusou", SEM_RESPOSTA: "Não respondeu",
  VAGA_PREENCHIDA: "Vaga preenchida por outro", CANCELADA: "Cancelada", FALHA_ENVIO: "Falha no envio", INELEGIVEL: "Conflito de agenda",
};

// ------------------------------------------------------------------ datas (America/Sao_Paulo, UTC-3)
const agora = () => new Date().toISOString();
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const hora5 = (h: string) => h.slice(0, 5);
const instante = (data: string, h: string) => new Date(`${data}T${hora5(h)}:00-03:00`).getTime();
function somarDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
function diasLetivos(ini: string, fim: string) {
  const dias: string[] = [];
  for (let d = ini; d <= fim && dias.length < 400; d = somarDias(d, 1)) dias.push(d);
  const uteis = dias.filter((d) => diaSemana(d) >= 1 && diaSemana(d) <= 5);
  return uteis.length ? uteis : dias;
}
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
function proximoDiaUtil(n: number) {
  let d = hoje();
  let achados = 0;
  while (achados < n) {
    d = somarDias(d, 1);
    if (diaSemana(d) >= 1 && diaSemana(d) <= 5) achados++;
  }
  return d;
}
const fmtData = (iso: string) => iso.split("-").reverse().join("/");
const periodo = (s: Sol) => (s.data_inicio === s.data_fim ? fmtData(s.data_inicio) : `${fmtData(s.data_inicio)} a ${fmtData(s.data_fim)}`);
const fmtDH = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

// ------------------------------------------------------------------ estado
let st: Estado;

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(st));
  } catch {
    /* navegação privada: segue só em memória */
  }
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const e = JSON.parse(bruto) as Estado;
      if (e.versao === VERSAO) return e;
    }
  } catch {
    /* ignora */
  }
  return semear();
}

const novoId = () => ++st.seq;

function registrar(acao: string, entidade: string, entidade_id: number | null, dados: any = {}, ator?: { tipo: string; id: number | null }, escola_id: number | null = null) {
  const anterior = st.log.length ? st.log[st.log.length - 1].hash : "0".repeat(16);
  const r: Reg = {
    id: st.log.length + 1, ocorrido_em: agora(), ator_tipo: ator?.tipo ?? "SISTEMA", ator_id: ator?.id ?? null, acao, entidade,
    entidade_id, escola_id, dados, ip: "demo", hash_anterior: anterior, hash: "",
  };
  r.hash = hashReg(r);
  st.log.push(r);
}

function hashReg(r: Reg) {
  // FNV-1a de 64 bits (na API real é SHA-256)
  const texto = r.hash_anterior + JSON.stringify([r.ocorrido_em, r.ator_tipo, r.ator_id, r.acao, r.entidade, r.entidade_id, r.escola_id, r.dados]);
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < texto.length; i++) {
    h ^= BigInt(texto.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

// ------------------------------------------------------------------ dados iniciais
function cpfValido(v: string) {
  const c = v.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(c[n])) return false;
  }
  return true;
}
function gerarCpf(semente: number) {
  const base = String(100000000 + semente * 7919).slice(-9).split("").map(Number);
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += base[i] * (n + 1 - i);
    base.push(((soma * 10) % 11) % 10);
  }
  return base.join("");
}

const NOMES = ["Ana Paula", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Hugo", "Isabel", "João Pedro", "Karina", "Lucas", "Marina", "Nelson", "Olívia", "Paulo", "Renata", "Sérgio", "Tatiana", "Vítor"];
const SOBRENOMES = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Costa", "Almeida", "Ferreira", "Rodrigues"];

function nomeProf(i: number) {
  const a = (i + Math.floor((i - 1) / NOMES.length) * 3) % SOBRENOMES.length;
  let b = (i * 7 + 4) % SOBRENOMES.length;
  if (b === a) b = (b + 1) % SOBRENOMES.length;
  return `${NOMES[(i - 1) % NOMES.length]} ${SOBRENOMES[a]} ${SOBRENOMES[b]}`;
}

function semear(): Estado {
  st = {
    versao: VERSAO, seq: 100, escolas: [], usuarios: [], disciplinas: [], profs: [], listas: [], classif: [], sols: [], log: [],
    config: {
      tamanho_onda: 3, timeout_minutos: 3, timeout_minutos_urgente: 1, aceitar_resposta_tardia: true,
      politica_recusa: "MANTER", dias_suspensao_recusa: 0, politica_sem_resposta: "MANTER", dias_suspensao_sem_resposta: 0,
      exclusividade_no_periodo: false, max_substituicoes_simultaneas: null, carga_horaria_max_semanal: null,
    },
  };
  st.escolas = [
    { id: 1, nome: "EMEF Monteiro Lobato", codigo_inep: "35123401", endereco: "Rua das Palmeiras, 101", telefone: "(16) 3333-0001", ativa: true },
    { id: 2, nome: "EMEI Cecília Meireles", codigo_inep: "35123402", endereco: "Av. Brasil, 202", telefone: "(16) 3333-0002", ativa: true },
    { id: 3, nome: "EMEF Paulo Freire", codigo_inep: "35123403", endereco: "Rua XV de Novembro, 303", telefone: "(16) 3333-0003", ativa: true },
  ];
  st.usuarios = [
    { id: 1, nome: "Secretaria de Educação", email: "admin@exemplo.gov.br", cpf: null, telefone: null, perfil: "admin", ativo: true, escola_ids: [], senha: "admin12345", ultimo_login_em: null },
    { id: 2, nome: "Diretora Márcia Andrade", email: "diretor@exemplo.gov.br", cpf: null, telefone: "(16) 99111-0002", perfil: "diretor", ativo: true, escola_ids: [1], senha: "diretor12345", ultimo_login_em: null },
    { id: 3, nome: "Diretor Roberto Nunes", email: "diretor2@exemplo.gov.br", cpf: null, telefone: "(16) 99111-0003", perfil: "diretor", ativo: true, escola_ids: [2, 3], senha: "diretor12345", ultimo_login_em: null },
  ];
  st.disciplinas = ["Polivalente", "Matemática", "Língua Portuguesa", "Ciências", "Educação Física", "Arte", "Inglês"].map((nome, i) => ({ id: i + 1, nome }));
  const D = Object.fromEntries(st.disciplinas.map((d) => [d.nome, d.id]));
  st.listas = [{ id: 1, nome: "PSS 2026 — Professor Substituto", edital: "01/2026", ativa: true, arquivo_nome: "classificacao-pss-2026.csv", arquivo_sha256: "9f2c41d07a6be35e8c11f0d2b7a4e96c0e5d3a8b1f7c2e4d6a9b0c3e5f7a1d2b", importada_em: agora() }];
  for (let i = 1; i <= 40; i++) {
    const habs: Prof["habs"] = [];
    if (i % 2 === 1 || i <= 12) habs.push({ etapa: "EF1", disciplina_id: D["Polivalente"] });
    if (i % 4 === 0) habs.push({ etapa: "EF2", disciplina_id: D["Matemática"] });
    if (i % 4 === 2) habs.push({ etapa: "EF2", disciplina_id: D["Língua Portuguesa"] });
    if (i % 6 === 3) habs.push({ etapa: "EF1", disciplina_id: D["Educação Física"] }, { etapa: "EF2", disciplina_id: D["Educação Física"] });
    if (i % 5 === 2) habs.push({ etapa: "EI", disciplina_id: D["Polivalente"] });
    if (i % 9 === 1) habs.push({ etapa: "EF2", disciplina_id: D["Ciências"] });
    if (i % 10 === 7) habs.push({ etapa: "EF2", disciplina_id: D["Arte"] });
    if (i % 11 === 8) habs.push({ etapa: "EF2", disciplina_id: D["Inglês"] });
    st.profs.push({
      id: i, nome: nomeProf(i),
      cpf: gerarCpf(i), email: `prof${i}@exemplo.com`, telefone: `(16) 99999-${String(i).padStart(4, "0")}`, ativo: true, suspenso_ate: null,
      vinculado: i !== 4, consentimento: i !== 9, bloqueado: false, habs,
      indisp: i === 6 ? [{ ini: hoje(), fim: somarDias(hoje(), 14), motivo: "Curso de formação" }] : [],
    });
    st.classif.push({ lista_id: 1, professor_id: i, posicao: i, rebaixado_em: null });
  }
  registrar("LISTA_IMPORTADA", "lista_classificacao", 1, { linhas: 40, arquivo: "classificacao-pss-2026.csv" }, { tipo: "USUARIO", id: 1 });

  // Exemplos já em andamento, gerados pelo próprio motor
  const dir = st.usuarios[1];
  const s1 = criar(dir, { escola_id: 1, disciplina_id: D["Polivalente"], etapa: "EF1", turma: "2º B", turno: "MANHA", data_inicio: proximoDiaUtil(1), data_fim: proximoDiaUtil(1), hora_inicio: "07:00", hora_fim: "11:30", motivo: "Licença médica", observacoes: "Plano de aula com a coordenadora.", urgente: false });
  responder(convDe(s1, 1).id, "recuso");
  responder(convDe(s1, 2).id, "aceito");
  const s2 = criar(dir, { escola_id: 1, disciplina_id: D["Matemática"], etapa: "EF2", turma: "7º A", turno: "TARDE", data_inicio: proximoDiaUtil(2), data_fim: proximoDiaUtil(4), hora_inicio: "13:00", hora_fim: "17:30", motivo: "Licença-prêmio", observacoes: "Conteúdo: frações e porcentagem.", urgente: false });
  for (const c of [...ondaAberta(s2)!.convocacoes]) responder(c.id, "recuso");
  const s3 = criar(st.usuarios[2], { escola_id: 2, disciplina_id: D["Polivalente"], etapa: "EI", turma: "Maternal II", turno: "MANHA", data_inicio: proximoDiaUtil(1), data_fim: proximoDiaUtil(1), hora_inicio: "07:30", hora_fim: "11:30", motivo: null, observacoes: null, urgente: true });
  responder(ondaAberta(s3)!.convocacoes[0].id, "aceito");
  return st;
}

// ------------------------------------------------------------------ motor (espelha backend/app/services/motor.py)
const prof = (id: number) => st.profs.find((p) => p.id === id)!;
const solDe = (id: number) => st.sols.find((s) => s.id === id);
const convsCiclo = (s: Sol) => s.ondas.filter((o) => o.ciclo === s.ciclo).flatMap((o) => o.convocacoes);
const ondaAberta = (s: Sol) => s.ondas.find((o) => o.ciclo === s.ciclo && !o.encerrada_em);
const convDe = (s: Sol, posicao: number) => convsCiclo(s).find((c) => c.posicao === posicao)!;
function acharConv(id: number): [Sol, Onda, Conv] | null {
  for (const s of st.sols) for (const o of s.ondas) for (const c of o.convocacoes) if (c.id === id) return [s, o, c];
  return null;
}

function fila(s: Sol) {
  return st.classif
    .filter((c) => c.lista_id === s.lista_id && prof(c.professor_id).habs.some((h) => h.etapa === s.etapa && h.disciplina_id === s.disciplina_id))
    .sort((a, b) => (a.rebaixado_em ?? "") .localeCompare(b.rebaixado_em ?? "") || a.posicao - b.posicao)
    .map((c, i) => ({ c, ordem: i + 1 }));
}

function ocupacoes(profId: number, s: Sol) {
  return st.sols.filter((o) => o.id !== s.id && o.status === "PREENCHIDA" && o.professor_aceito_id === profId && o.data_inicio <= s.data_fim && o.data_fim >= s.data_inicio);
}

function motivoConflito(s: Sol, ocup: Sol[]): string | null {
  const cfg = st.config;
  const dias = new Set(diasLetivos(s.data_inicio, s.data_fim));
  let simultaneas = 0;
  for (const o of ocup) {
    if (!diasLetivos(o.data_inicio, o.data_fim).some((d) => dias.has(d))) continue;
    simultaneas++;
    if (minutos(o.hora_inicio) < minutos(s.hora_fim) && minutos(s.hora_inicio) < minutos(o.hora_fim)) return "CONFLITO_HORARIO";
    if (cfg.exclusividade_no_periodo) return "SUBSTITUICAO_NO_PERIODO";
  }
  if (cfg.max_substituicoes_simultaneas !== null && simultaneas >= cfg.max_substituicoes_simultaneas) return "LIMITE_SIMULTANEAS";
  if (cfg.carga_horaria_max_semanal !== null) {
    const semana = (d: string) => somarDias(d, -((diaSemana(d) + 6) % 7));
    const horas: Record<string, number> = {};
    for (const x of [s, ...ocup]) {
      const h = (minutos(x.hora_fim) - minutos(x.hora_inicio)) / 60;
      for (const d of diasLetivos(x.data_inicio, x.data_fim)) if (x === s || dias.has(d) || horas[semana(d)] !== undefined) horas[semana(d)] = (horas[semana(d)] ?? 0) + h;
    }
    if (Object.values(horas).some((h) => h > cfg.carga_horaria_max_semanal!)) return "CARGA_HORARIA";
  }
  return null;
}

function motivoInelegivel(p: Prof, s: Sol): string | null {
  if (!p.ativo) return "INATIVO";
  if (!p.vinculado) return "SEM_VINCULO_BOT";
  if (!p.consentimento) return "SEM_CONSENTIMENTO";
  if (p.bloqueado) return "BOT_BLOQUEADO";
  if (p.suspenso_ate && p.suspenso_ate >= hoje()) return "SUSPENSO";
  const dias = diasLetivos(s.data_inicio, s.data_fim);
  if (p.indisp.some((i) => dias.some((d) => i.ini <= d && d <= i.fim))) return "INDISPONIVEL";
  return motivoConflito(s, ocupacoes(p.id, s));
}

function dispararOnda(s: Sol) {
  const ja = new Set(convsCiclo(s).map((c) => c.professor_id));
  const escolhidos: { c: Classif; ordem: number }[] = [];
  const pulos: Pulo[] = [];
  for (const it of fila(s)) {
    if (escolhidos.length >= st.config.tamanho_onda) break;
    if (ja.has(it.c.professor_id)) continue;
    const m = motivoInelegivel(prof(it.c.professor_id), s);
    if (m) pulos.push({ professor_id: it.c.professor_id, posicao: it.c.posicao, ordem: it.ordem, motivo: m });
    else escolhidos.push(it);
  }
  if (!escolhidos.length) {
    encerrar(s, "ESGOTADA");
    registrar("FILA_ESGOTADA", "solicitacao", s.id, { ciclo: s.ciclo, pulos }, undefined, s.escola_id);
    return;
  }
  const inicio = new Date();
  const onda: Onda = {
    id: novoId(), ciclo: s.ciclo, numero: s.ondas.filter((o) => o.ciclo === s.ciclo).length + 1, iniciada_em: inicio.toISOString(),
    expira_em: new Date(inicio.getTime() + s.timeout_minutos * 60000).toISOString(), encerrada_em: null, motivo_encerramento: null, pulos,
    convocacoes: escolhidos.map((it) => ({
      id: novoId(), professor_id: it.c.professor_id, posicao: it.c.posicao, ordem: it.ordem, ciclo: s.ciclo, status: "ENVIADA",
      criada_em: inicio.toISOString(), enviada_em: inicio.toISOString(), respondida_em: null, tempo_resposta_s: null,
    })),
  };
  s.ondas.push(onda);
  registrar("ONDA_DISPARADA", "onda", onda.id, {
    solicitacao_id: s.id, numero: onda.numero, convocados: onda.convocacoes.map((c) => ({ professor_id: c.professor_id, posicao: c.posicao })), pulos,
  }, undefined, s.escola_id);
}

function fecharOnda(o: Onda | undefined, motivo: string) {
  if (o && !o.encerrada_em) {
    o.encerrada_em = agora();
    o.motivo_encerramento = motivo;
  }
}

function penalizar(s: Sol, c: Conv, politica: Politica, dias: number, causa: string) {
  if (politica === "MANTER") return;
  const p = prof(c.professor_id);
  if (politica === "FIM_DA_LISTA") {
    const cl = st.classif.find((x) => x.lista_id === s.lista_id && x.professor_id === p.id);
    if (cl) cl.rebaixado_em = agora();
  } else if (dias > 0) {
    const ate = somarDias(hoje(), dias);
    if (!p.suspenso_ate || p.suspenso_ate < ate) p.suspenso_ate = ate;
  } else return;
  registrar("PENALIDADE_APLICADA", "professor", p.id, { causa, politica, dias, solicitacao_id: s.id }, undefined, s.escola_id);
}

function encerrar(s: Sol, status: StatusSol) {
  s.status = status;
  s.encerrada_em = agora();
  const motivo = ({ PREENCHIDA: "ACEITE", CANCELADA: "CANCELADA", EXPIRADA: "EXPIRADA" } as Record<string, string>)[status];
  if (motivo) fecharOnda(ondaAberta(s), motivo);
  if (status === "CANCELADA") return;
  for (const c of convsCiclo(s).filter((x) => x.status === "SEM_RESPOSTA"))
    penalizar(s, c, st.config.politica_sem_resposta, st.config.dias_suspensao_sem_resposta, "SEM_RESPOSTA");
}

function avancarSeConcluida(s: Sol) {
  if (s.status !== "EM_CONVOCACAO") return;
  const o = ondaAberta(s);
  if (o && !o.convocacoes.some((c) => c.status === "ENVIADA")) {
    fecharOnda(o, "TODOS_RECUSARAM");
    dispararOnda(s);
  }
}

function responder(convId: number, resposta: "aceito" | "recuso"): { resultado: string; mensagem: string } {
  const achado = acharConv(convId);
  if (!achado) throw new ErroApi(404, "Convocação não encontrada.");
  const [s, , c] = achado;
  const reg = (resultado: string, mensagem: string) => {
    registrar(resposta === "aceito" ? "RESPOSTA_ACEITE" : "RESPOSTA_RECUSA", "convocacao", c.id, { solicitacao_id: s.id, resultado }, { tipo: "PROFESSOR", id: c.professor_id }, s.escola_id);
    return { resultado, mensagem };
  };
  if (c.status === "ACEITA") return reg("JA_RESPONDIDA", "Você já aceitou esta vaga.");
  if (c.status === "RECUSADA" || c.status === "INELEGIVEL") return reg("JA_RESPONDIDA", "Sua resposta já foi registrada.");
  if (c.ciclo !== s.ciclo || c.status === "CANCELADA") return reg("SOLICITACAO_ENCERRADA", "Esta convocação foi encerrada.");
  if (s.status === "PREENCHIDA" || c.status === "VAGA_PREENCHIDA") return reg("VAGA_JA_PREENCHIDA", "Esta vaga já foi preenchida.");
  if (s.status !== "EM_CONVOCACAO") return reg("SOLICITACAO_ENCERRADA", "Esta convocação foi encerrada.");
  const tardia = c.status === "SEM_RESPOSTA";
  const marcar = (status: StatusConv) => {
    c.status = status;
    c.respondida_em = agora();
    c.tempo_resposta_s = Math.round((Date.now() - new Date(c.criada_em).getTime()) / 1000);
  };
  if (resposta === "recuso") {
    marcar("RECUSADA");
    penalizar(s, c, st.config.politica_recusa, st.config.dias_suspensao_recusa, "RECUSA");
    const r = reg("RECUSA_REGISTRADA", "Recusa registrada.");
    avancarSeConcluida(s);
    return r;
  }
  if (tardia && !st.config.aceitar_resposta_tardia) return reg("PRAZO_ENCERRADO", "O prazo para responder terminou.");
  if (motivoConflito(s, ocupacoes(c.professor_id, s))) {
    marcar("INELEGIVEL");
    const r = reg("CONFLITO", "Já tem substituição aceita que conflita com esta vaga.");
    avancarSeConcluida(s);
    return r;
  }
  marcar("ACEITA");
  s.professor_aceito_id = c.professor_id;
  s.preenchida_em = agora();
  for (const o of convsCiclo(s)) if (o !== c && o.status === "ENVIADA") o.status = "VAGA_PREENCHIDA";
  encerrar(s, "PREENCHIDA");
  registrar("VAGA_PREENCHIDA", "solicitacao", s.id, { professor_id: c.professor_id, posicao: c.posicao, aceite_tardio: tardia }, undefined, s.escola_id);
  return reg("VAGA_CONCEDIDA", "Vaga confirmada para o professor.");
}

function timeout(s: Sol) {
  const o = ondaAberta(s);
  if (!o) return;
  for (const c of o.convocacoes) if (c.status === "ENVIADA") c.status = "SEM_RESPOSTA";
  fecharOnda(o, "TIMEOUT");
  registrar("ONDA_TIMEOUT", "onda", o.id, { solicitacao_id: s.id, numero: o.numero }, undefined, s.escola_id);
  dispararOnda(s);
}

function tick() {
  if (!st) return;
  let mudou = false;
  for (const s of st.sols) {
    if (s.status !== "EM_CONVOCACAO") continue;
    if (instante(s.data_fim, s.hora_fim) <= Date.now()) {
      for (const c of convsCiclo(s)) if (c.status === "ENVIADA") c.status = "SEM_RESPOSTA";
      encerrar(s, "EXPIRADA");
      registrar("SOLICITACAO_EXPIRADA", "solicitacao", s.id, {}, undefined, s.escola_id);
      mudou = true;
      continue;
    }
    const o = ondaAberta(s);
    if (o && new Date(o.expira_em).getTime() <= Date.now()) {
      timeout(s);
      mudou = true;
    }
  }
  if (mudou) salvar();
}

function criar(u: Usr, d: any): Sol {
  if (d.data_fim < d.data_inicio) throw new ErroApi(422, "A data final deve ser igual ou posterior à data inicial.");
  if (minutos(d.hora_fim) <= minutos(d.hora_inicio)) throw new ErroApi(422, "O horário final deve ser posterior ao inicial.");
  if (instante(d.data_fim, d.hora_fim) <= Date.now()) throw new ErroApi(422, "O período informado já terminou.");
  if (!d.turma?.trim()) throw new ErroApi(422, "turma: informe a turma");
  const lista = st.listas.find((l) => l.ativa);
  if (!lista) throw new ErroApi(422, "Não há lista de classificação ativa. Contate a Secretaria.");
  const s: Sol = {
    id: novoId(), escola_id: d.escola_id, criada_por_id: u.id, lista_id: lista.id, disciplina_id: d.disciplina_id, etapa: d.etapa,
    turma: d.turma.trim(), turno: d.turno, data_inicio: d.data_inicio, data_fim: d.data_fim, hora_inicio: hora5(d.hora_inicio),
    hora_fim: hora5(d.hora_fim), motivo: d.motivo ?? null, observacoes: d.observacoes ?? null, urgente: !!d.urgente,
    timeout_minutos: d.urgente ? st.config.timeout_minutos_urgente : st.config.timeout_minutos, status: "EM_CONVOCACAO", ciclo: 1,
    professor_aceito_id: null, preenchida_em: null, encerrada_em: null, motivo_cancelamento: null, criada_em: agora(), ondas: [],
  };
  st.sols.push(s);
  registrar("SOLICITACAO_CRIADA", "solicitacao", s.id, { turma: s.turma, periodo: [s.data_inicio, s.data_fim], urgente: s.urgente }, { tipo: "USUARIO", id: u.id }, s.escola_id);
  dispararOnda(s);
  return s;
}

// ------------------------------------------------------------------ saída (mesmo formato da API)
const nomeDisc = (id: number) => st.disciplinas.find((d) => d.id === id)?.nome ?? "?";
const escolaRes = (id: number) => {
  const e = st.escolas.find((x) => x.id === id)!;
  return { id: e.id, nome: e.nome };
};

function resumo(s: Sol) {
  const o = s.status === "EM_CONVOCACAO" ? ondaAberta(s) : undefined;
  return {
    id: s.id, escola: escolaRes(s.escola_id), disciplina: nomeDisc(s.disciplina_id), etapa: s.etapa, turma: s.turma, turno: s.turno,
    data_inicio: s.data_inicio, data_fim: s.data_fim, hora_inicio: s.hora_inicio, hora_fim: s.hora_fim, urgente: s.urgente, status: s.status,
    ciclo: s.ciclo, criada_em: s.criada_em, preenchida_em: s.preenchida_em,
    professor_aceito: s.professor_aceito_id ? prof(s.professor_aceito_id).nome : null, onda_atual: o?.numero ?? null, expira_em: o?.expira_em ?? null,
  };
}

function detalhe(s: Sol) {
  const p = s.status === "PREENCHIDA" && s.professor_aceito_id ? prof(s.professor_aceito_id) : null;
  return {
    ...resumo(s), motivo: s.motivo, observacoes: s.observacoes, timeout_minutos: s.timeout_minutos, motivo_cancelamento: s.motivo_cancelamento,
    encerrada_em: s.encerrada_em, criada_por: st.usuarios.find((u) => u.id === s.criada_por_id)?.nome ?? "",
    contato_professor: p ? { nome: p.nome, telefone: p.telefone, email: p.email } : null,
    escola_endereco: st.escolas.find((e) => e.id === s.escola_id)?.endereco,
    etapa_nome: ETAPAS[s.etapa], turno_nome: TURNOS[s.turno],
    ondas: [...s.ondas].reverse().map((o) => ({
      id: o.id, ciclo: o.ciclo, numero: o.numero, iniciada_em: o.iniciada_em, expira_em: o.expira_em, encerrada_em: o.encerrada_em,
      motivo_encerramento: o.motivo_encerramento,
      convocacoes: o.convocacoes.map((c) => ({ ...c, professor: prof(c.professor_id).nome, status_texto: STATUS_CONV[c.status] })),
      pulos: o.pulos.map((x) => ({ ...x, professor: prof(x.professor_id).nome, motivo_texto: MOTIVO_PULO[x.motivo] })),
    })),
  };
}

function profOut(p: Prof, posicao: number | null = null) {
  const c = p.cpf;
  return {
    id: p.id, nome: p.nome, cpf_mascarado: `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`, email: p.email, telefone: p.telefone, ativo: p.ativo,
    suspenso_ate: p.suspenso_ate, vinculado_bot: p.vinculado, consentimento: p.vinculado && p.consentimento, bot_bloqueado: p.bloqueado, posicao,
    habilitacoes: p.habs.map((h) => ({ ...h, disciplina: nomeDisc(h.disciplina_id) })),
  };
}

function usrOut(u: Usr) {
  return {
    id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo, telefone: u.telefone, ultimo_login_em: u.ultimo_login_em,
    escolas: u.escola_ids.map(escolaRes),
  };
}

function csv(linhas: (string | number | null)[][]) {
  return "﻿" + linhas.map((l) => l.map((v) => {
    const t = v === null ? "" : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  }).join(";")).join("\n") + "\n";
}

function indicadores(sols: Sol[]) {
  const por: Record<string, number> = {};
  for (const s of sols) por[s.status] = (por[s.status] ?? 0) + 1;
  const encerradas = sols.filter((s) => s.status !== "EM_CONVOCACAO" && s.status !== "CANCELADA");
  const tempos = sols.filter((s) => s.preenchida_em).map((s) => (new Date(s.preenchida_em!).getTime() - new Date(s.criada_em).getTime()) / 60000);
  const convs = sols.flatMap((s) => s.ondas.flatMap((o) => o.convocacoes));
  const porEscola: Record<string, number> = {};
  for (const s of sols) porEscola[escolaRes(s.escola_id).nome] = (porEscola[escolaRes(s.escola_id).nome] ?? 0) + 1;
  return {
    total: sols.length, por_status: por,
    taxa_preenchimento: encerradas.length ? (por.PREENCHIDA ?? 0) / encerradas.length : null,
    tempo_medio_preenchimento_min: tempos.length ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10 : null,
    taxa_aceite_por_convocacao: convs.length ? convs.filter((c) => c.status === "ACEITA").length / convs.length : null,
    por_escola: porEscola,
  };
}

// ------------------------------------------------------------------ importação (CSV)
const chave = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const ALIAS_COL: Record<string, string[]> = {
  posicao: ["posicao", "classificacao", "pos", "colocacao", "ordem"], nome: ["nome", "nome completo", "candidato", "professor"],
  cpf: ["cpf"], habilitacoes: ["habilitacoes", "habilitacao", "areas", "area"], email: ["email", "e-mail"], telefone: ["telefone", "celular", "fone", "whatsapp"],
};
const ALIAS_ETAPA: Record<string, Etapa> = {
  ei: "EI", infantil: "EI", "educacao infantil": "EI", ef1: "EF1", "fundamental i": "EF1", "anos iniciais": "EF1", ef2: "EF2",
  "fundamental ii": "EF2", "anos finais": "EF2", eja: "EJA", ee: "EE", "educacao especial": "EE", aee: "EE",
};

function lerCsv(texto: string) {
  texto = texto.replace(/^﻿/, "");
  const delim = (texto.split("\n")[0].match(/;/g)?.length ?? 0) >= (texto.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') aspas = false; else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === delim) { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

async function importar(form: FormData, u: Usr) {
  const arquivo = form.get("arquivo") as File | null;
  if (!arquivo) throw new ErroApi(422, "Envie um arquivo.");
  if (!/\.(csv|txt)$/i.test(arquivo.name)) throw new ErroApi(422, "Na demonstração, use um arquivo .csv (o sistema instalado também aceita .xlsx).");
  const linhas = lerCsv(await arquivo.text());
  const erros: { linha: number; campo: string; mensagem: string }[] = [];
  const avisos: typeof erros = [];
  const res = (extra: any = {}) => ({ ok: false, confirmado: false, total_linhas: Math.max(0, linhas.length - 1), erros, avisos, professores_novos: 0, professores_atualizados: 0, disciplinas_novas: [] as string[], lista_id: null, previa: [], ...extra });
  if (!linhas.length) { erros.push({ linha: 0, campo: "arquivo", mensagem: "Arquivo vazio." }); return res(); }
  const mapa: Record<string, number> = {};
  linhas[0].forEach((col, i) => {
    for (const [campo, aliases] of Object.entries(ALIAS_COL)) if (aliases.includes(chave(col)) && mapa[campo] === undefined) mapa[campo] = i;
  });
  const faltando = ["posicao", "nome", "cpf", "habilitacoes"].filter((c) => mapa[c] === undefined);
  if (faltando.length) { erros.push({ linha: 1, campo: "cabeçalho", mensagem: `Colunas obrigatórias ausentes: ${faltando.join(", ")}` }); return res(); }
  const val = (row: string[], c: string) => (mapa[c] !== undefined ? (row[mapa[c]] ?? "").trim() : "");
  const validas: any[] = [];
  const vistosCpf: Record<string, number> = {}, vistasPos: Record<number, number> = {};
  linhas.slice(1).forEach((row, idx) => {
    const n = idx + 2;
    let ok = true;
    const erro = (campo: string, mensagem: string) => { ok = false; erros.push({ linha: n, campo, mensagem }); };
    const pos = Number(val(row, "posicao").replace(/[ºo°.]$/, ""));
    if (!Number.isInteger(pos) || pos <= 0) erro("posicao", `posição inválida: '${val(row, "posicao")}'`);
    else if (vistasPos[pos]) erro("posicao", `posição ${pos} repetida (linha ${vistasPos[pos]})`);
    else vistasPos[pos] = n;
    const nome = val(row, "nome").replace(/\s+/g, " ");
    if (nome.length < 3) erro("nome", "nome ausente ou muito curto");
    let cpf = val(row, "cpf").replace(/\D/g, "");
    if (cpf && cpf.length < 11) cpf = cpf.padStart(11, "0");
    if (!cpfValido(cpf)) erro("cpf", `CPF inválido: '${val(row, "cpf")}'`);
    else if (vistosCpf[cpf]) erro("cpf", `CPF repetido (linha ${vistosCpf[cpf]})`);
    else vistosCpf[cpf] = n;
    const habs: [Etapa, string][] = [];
    const habTxt = val(row, "habilitacoes");
    for (const item of habTxt.split("|").map((x) => x.trim()).filter(Boolean)) {
      const m = item.match(/^\s*([^:]+?)\s*[:\-–]\s*(.+?)\s*$/);
      if (!m) { erro("habilitacoes", `'${item}' não está no formato ETAPA:Disciplina`); continue; }
      const et = ALIAS_ETAPA[chave(m[1])];
      if (!et) { erro("habilitacoes", `etapa desconhecida '${m[1]}' (use EI, EF1, EF2, EJA ou EE)`); continue; }
      habs.push([et, m[2]]);
    }
    if (!habTxt) erro("habilitacoes", "nenhuma habilitação informada");
    if (ok) validas.push({ pos, nome, cpf, email: val(row, "email") || null, telefone: val(row, "telefone") || null, habs });
  });
  validas.sort((a, b) => a.pos - b.pos);
  const discs = new Map(st.disciplinas.map((d) => [chave(d.nome), d]));
  const novas = new Map<string, string>();
  for (const l of validas) for (const [, d] of l.habs) if (!discs.has(chave(d)) && !novas.has(chave(d))) novas.set(chave(d), d);
  for (const d of novas.values()) avisos.push({ linha: 0, campo: "habilitacoes", mensagem: `disciplina nova será cadastrada: '${d}'` });
  const existentes = new Map(st.profs.map((p) => [p.cpf, p]));
  const novos = validas.filter((l) => !existentes.has(l.cpf)).length;
  const ok = !erros.length && validas.length > 0;
  const confirmar = form.get("confirmar") === "true";
  const base = {
    ok, total_linhas: linhas.length - 1, professores_novos: novos, professores_atualizados: validas.length - novos, disciplinas_novas: [...novas.values()],
    previa: validas.slice(0, 50).map((l) => ({ posicao: l.pos, nome: l.nome, cpf_final: l.cpf.slice(-4), habilitacoes: l.habs.map((h: string[]) => `${h[0]}:${h[1]}`), novo: !existentes.has(l.cpf) })),
  };
  if (ok) avisos.push({ linha: 0, campo: "demo", mensagem: "Na demonstração, professores novos já entram vinculados ao bot e com consentimento." });
  if (!ok || !confirmar) return res(base);
  for (const [k, nome] of novas) { const d = { id: novoId(), nome }; st.disciplinas.push(d); discs.set(k, d); }
  const lista: Lista = { id: novoId(), nome: String(form.get("nome") ?? "Lista"), edital: (form.get("edital") as string) || null, ativa: false, arquivo_nome: arquivo.name, arquivo_sha256: hashReg({ hash_anterior: arquivo.name, dados: linhas } as any).repeat(4), importada_em: agora() };
  st.listas.push(lista);
  for (const l of validas) {
    let p = existentes.get(l.cpf);
    if (!p) {
      p = { id: novoId(), nome: l.nome, cpf: l.cpf, email: l.email, telefone: l.telefone, ativo: true, suspenso_ate: null, vinculado: true, consentimento: true, bloqueado: false, habs: [], indisp: [] };
      st.profs.push(p);
    } else Object.assign(p, { nome: l.nome, email: l.email ?? p.email, telefone: l.telefone ?? p.telefone });
    p.habs = l.habs.map(([e, d]: [Etapa, string]) => ({ etapa: e, disciplina_id: discs.get(chave(d))!.id }));
    st.classif.push({ lista_id: lista.id, professor_id: p.id, posicao: l.pos, rebaixado_em: null });
  }
  if (form.get("ativar") !== "false") st.listas.forEach((x) => (x.ativa = x.id === lista.id));
  registrar("LISTA_IMPORTADA", "lista_classificacao", lista.id, { nome: lista.nome, linhas: validas.length }, { tipo: "USUARIO", id: u.id });
  return res({ ...base, confirmado: true, lista_id: lista.id });
}

// ------------------------------------------------------------------ roteamento
function usuarioAtual(): Usr {
  const id = Number((token() ?? "").replace("demo-", ""));
  const u = st.usuarios.find((x) => x.id === id && x.ativo);
  if (!u) throw new ErroApi(401, "Sessão expirada. Entre novamente.");
  return u;
}
const escopo = (u: Usr) => (u.perfil === "admin" ? null : u.escola_ids);
function solDoUsuario(u: Usr, id: number) {
  const s = solDe(id);
  const e = escopo(u);
  if (!s || (e && !e.includes(s.escola_id))) throw new ErroApi(404, "Não encontrado");
  return s;
}
function exigirAdmin(u: Usr) {
  if (u.perfil !== "admin") throw new ErroApi(403, "Acesso restrito à Secretaria");
}
function filtrar(q: URLSearchParams, permitidas: number[] | null) {
  return st.sols
    .filter((s) => !permitidas || permitidas.includes(s.escola_id))
    .filter((s) => !q.get("escola_id") || s.escola_id === Number(q.get("escola_id")))
    .filter((s) => !q.get("status") || s.status === q.get("status"))
    .filter((s) => !q.get("inicio") || s.data_fim >= q.get("inicio")!)
    .filter((s) => !q.get("fim") || s.data_inicio <= q.get("fim")!)
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio) || b.id - a.id);
}

async function rotear(metodo: string, caminho: string, q: URLSearchParams, corpo: any, form?: FormData): Promise<any> {
  const m = (re: RegExp) => caminho.match(re);
  let r: RegExpMatchArray | null;

  // ---- autenticação
  if (caminho === "/api/auth/login") {
    const login = String(corpo.login ?? "").trim().toLowerCase();
    const u = st.usuarios.find((x) => x.email === login || (x.cpf && x.cpf === login.replace(/\D/g, "")));
    if (!u || u.senha !== corpo.senha || !u.ativo) {
      registrar("LOGIN_FALHOU", "usuario", u?.id ?? null, { login });
      throw new ErroApi(401, "Login ou senha incorretos");
    }
    u.ultimo_login_em = agora();
    registrar("LOGIN", "usuario", u.id, {}, { tipo: "USUARIO", id: u.id });
    return { access_token: `demo-${u.id}`, token_type: "bearer", usuario: usrOut(u) };
  }
  if (caminho === "/api/auth/esqueci-senha") return { mensagem: "Se o e-mail estiver cadastrado, você receberá um link em instantes. (Na demonstração nenhum e-mail é enviado.)" };
  if (caminho === "/api/auth/redefinir-senha") throw new ErroApi(400, "Na demonstração não há envio de e-mail, então não há link de redefinição.");

  if (caminho === "/api/demo/reiniciar") {
    semear();
    return { ok: true };
  }

  const u = usuarioAtual();
  if (caminho === "/api/auth/me") return usrOut(u);
  if (caminho === "/api/escolas") return st.escolas.filter((e) => e.ativa && (!escopo(u) || escopo(u)!.includes(e.id))).sort((a, b) => a.nome.localeCompare(b.nome));
  if (caminho === "/api/catalogo")
    return {
      disciplinas: [...st.disciplinas].sort((a, b) => a.nome.localeCompare(b.nome)),
      etapas: Object.entries(ETAPAS).map(([id, nome]) => ({ id, nome })),
      turnos: Object.entries(TURNOS).map(([id, nome]) => ({ id, nome })),
    };

  // ---- solicitações (diretor e admin)
  if (caminho === "/api/solicitacoes" && metodo === "GET") return filtrar(q, escopo(u)).map(resumo);
  if (caminho === "/api/solicitacoes" && metodo === "POST") {
    if (escopo(u) && !escopo(u)!.includes(corpo.escola_id)) throw new ErroApi(404, "Não encontrado");
    if (!corpo.disciplina_id) throw new ErroApi(422, "disciplina_id: selecione a disciplina");
    return detalhe(criar(u, corpo));
  }
  if ((r = m(/^\/api\/solicitacoes\/(\d+)$/))) return detalhe(solDoUsuario(u, Number(r[1])));
  if ((r = m(/^\/api\/solicitacoes\/(\d+)\/cancelar$/))) {
    const s = solDoUsuario(u, Number(r[1]));
    if (!["EM_CONVOCACAO", "PREENCHIDA", "ESGOTADA"].includes(s.status)) throw new ErroApi(409, "Esta solicitação não pode ser cancelada no estado atual.");
    for (const c of convsCiclo(s)) if (c.status === "ENVIADA") c.status = "CANCELADA";
    s.motivo_cancelamento = corpo?.motivo?.trim() || null;
    encerrar(s, "CANCELADA");
    registrar("SOLICITACAO_CANCELADA", "solicitacao", s.id, { motivo: s.motivo_cancelamento }, { tipo: "USUARIO", id: u.id }, s.escola_id);
    return detalhe(s);
  }
  if ((r = m(/^\/api\/solicitacoes\/(\d+)\/reabrir$/))) {
    const s = solDoUsuario(u, Number(r[1]));
    if (!["CANCELADA", "ESGOTADA", "EXPIRADA"].includes(s.status)) throw new ErroApi(409, "Só é possível reabrir solicitações canceladas, esgotadas ou expiradas.");
    if (instante(s.data_fim, s.hora_fim) <= Date.now()) throw new ErroApi(409, "O período desta solicitação já terminou; crie uma nova.");
    const ativa = st.listas.find((l) => l.ativa);
    if (!ativa) throw new ErroApi(409, "Não há lista de classificação ativa.");
    Object.assign(s, { lista_id: ativa.id, ciclo: s.ciclo + 1, status: "EM_CONVOCACAO", professor_aceito_id: null, preenchida_em: null, encerrada_em: null, motivo_cancelamento: null });
    registrar("SOLICITACAO_REABERTA", "solicitacao", s.id, { ciclo: s.ciclo }, { tipo: "USUARIO", id: u.id }, s.escola_id);
    dispararOnda(s);
    return detalhe(s);
  }
  if ((r = m(/^\/api\/solicitacoes\/(\d+)\/comprovacao$/))) {
    const s = solDoUsuario(u, Number(r[1]));
    const linhas: (string | number | null)[][] = [["solicitacao", "ciclo", "onda", "ordem_efetiva", "posicao_oficial", "professor", "situacao", "detalhe", "enviada_em", "respondida_em", "tempo_resposta_s"]];
    for (const o of s.ondas) {
      const itens = [
        ...o.pulos.map((p) => [p.ordem, p.posicao, prof(p.professor_id).nome, "PULADO", MOTIVO_PULO[p.motivo], "", "", ""] as const),
        ...o.convocacoes.map((c) => [c.ordem, c.posicao, prof(c.professor_id).nome, "CONVOCADO", c.status, fmtDH(c.enviada_em), fmtDH(c.respondida_em), c.tempo_resposta_s ?? ""] as const),
      ].sort((a, b) => a[0] - b[0]);
      for (const it of itens) linhas.push([s.id, o.ciclo, o.numero, ...it]);
    }
    return csv(linhas);
  }

  // ---- simulador (só na demonstração): o professor responde pelo "bot"
  if (caminho === "/api/demo/responder") {
    const achado = acharConv(Number(corpo.convocacao_id));
    if (!achado) throw new ErroApi(404, "Convocação não encontrada.");
    solDoUsuario(u, achado[0].id);
    return responder(achado[2].id, corpo.resposta === "aceito" ? "aceito" : "recuso");
  }
  if (caminho === "/api/demo/encerrar-prazo") {
    const s = solDoUsuario(u, Number(corpo.solicitacao_id));
    if (s.status === "EM_CONVOCACAO") timeout(s);
    return detalhe(s);
  }

  // ---- Secretaria
  if (caminho.startsWith("/api/admin/")) exigirAdmin(u);
  if (caminho === "/api/admin/escolas" && metodo === "GET") return [...st.escolas].sort((a, b) => a.nome.localeCompare(b.nome));
  if (caminho === "/api/admin/escolas" || (r = m(/^\/api\/admin\/escolas\/(\d+)$/))) {
    const id = r ? Number(r[1]) : null;
    if (!corpo?.nome || corpo.nome.trim().length < 3) throw new ErroApi(422, "nome: informe o nome da escola");
    if (st.escolas.some((e) => e.id !== id && chave(e.nome) === chave(corpo.nome))) throw new ErroApi(409, "Já existe escola com esse nome ou código INEP.");
    const dados = { nome: corpo.nome.trim(), codigo_inep: corpo.codigo_inep || null, endereco: corpo.endereco || null, telefone: corpo.telefone || null, ativa: corpo.ativa !== false };
    let e = id ? st.escolas.find((x) => x.id === id) : undefined;
    if (id && !e) throw new ErroApi(404, "Não encontrado");
    if (e) Object.assign(e, dados);
    else st.escolas.push((e = { id: novoId(), ...dados }));
    registrar(id ? "ESCOLA_EDITADA" : "ESCOLA_CRIADA", "escola", e.id, dados, { tipo: "USUARIO", id: u.id }, e.id);
    return e;
  }
  if (caminho === "/api/admin/usuarios" && metodo === "GET") return [...st.usuarios].sort((a, b) => a.nome.localeCompare(b.nome)).map(usrOut);
  if (caminho === "/api/admin/usuarios" || (r = m(/^\/api\/admin\/usuarios\/(\d+)$/))) {
    const id = r ? Number(r[1]) : null;
    const email = String(corpo.email ?? "").trim().toLowerCase();
    if (!corpo.nome || corpo.nome.trim().length < 3) throw new ErroApi(422, "nome: informe o nome");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErroApi(422, "email: e-mail inválido");
    if (st.usuarios.some((x) => x.id !== id && x.email === email)) throw new ErroApi(409, "E-mail ou CPF já cadastrado.");
    const escolas: number[] = corpo.escola_ids ?? [];
    if (corpo.perfil === "diretor" && !escolas.length) throw new ErroApi(422, "Diretor precisa estar vinculado a pelo menos uma escola.");
    if (id === u.id && (corpo.ativo === false || corpo.perfil !== "admin")) throw new ErroApi(422, "Você não pode remover seu próprio acesso de administrador.");
    let alvo = id ? st.usuarios.find((x) => x.id === id) : undefined;
    if (id && !alvo) throw new ErroApi(404, "Não encontrado");
    const senhaProv = corpo.senha ? null : Math.random().toString(36).slice(2, 12);
    const dados = { nome: corpo.nome.trim(), email, telefone: corpo.telefone || null, perfil: corpo.perfil, ativo: corpo.ativo !== false, escola_ids: corpo.perfil === "admin" ? [] : escolas };
    if (alvo) {
      Object.assign(alvo, dados);
      if (corpo.cpf) alvo.cpf = String(corpo.cpf).replace(/\D/g, "");
      if (corpo.senha) alvo.senha = corpo.senha;
    } else {
      alvo = { id: novoId(), ...dados, cpf: corpo.cpf ? String(corpo.cpf).replace(/\D/g, "") : null, senha: corpo.senha || senhaProv!, ultimo_login_em: null };
      st.usuarios.push(alvo);
    }
    registrar(id ? "USUARIO_EDITADO" : "USUARIO_CRIADO", "usuario", alvo.id, { perfil: alvo.perfil, escola_ids: alvo.escola_ids }, { tipo: "USUARIO", id: u.id });
    return id ? usrOut(alvo) : { usuario: usrOut(alvo), senha_provisoria: senhaProv };
  }
  if (caminho === "/api/admin/professores" && metodo === "GET") {
    const lista = st.listas.find((l) => l.ativa);
    const busca = chave(q.get("busca") ?? "");
    const pos = (p: Prof) => st.classif.find((c) => c.lista_id === lista?.id && c.professor_id === p.id)?.posicao ?? null;
    return st.profs
      .filter((p) => !busca || chave(p.nome).includes(busca) || p.cpf === busca.replace(/\D/g, ""))
      .map((p) => profOut(p, pos(p)))
      .sort((a, b) => (a.posicao ?? 1e9) - (b.posicao ?? 1e9) || a.nome.localeCompare(b.nome));
  }
  if ((r = m(/^\/api\/admin\/professores\/(\d+)\/codigo-vinculo$/))) {
    const p = st.profs.find((x) => x.id === Number(r![1]));
    if (!p) throw new ErroApi(404, "Não encontrado");
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    registrar("CODIGO_VINCULO_GERADO", "professor", p.id, {}, { tipo: "USUARIO", id: u.id });
    return { codigo, expira_em: new Date(Date.now() + 7 * 86400000).toISOString(), instrucoes: `Abra o bot da Secretaria no Telegram, toque em Iniciar, informe o CPF e o código ${codigo}.` };
  }
  if (caminho === "/api/admin/professores" || (r = m(/^\/api\/admin\/professores\/(\d+)$/))) {
    const id = r ? Number(r[1]) : null;
    const cpf = String(corpo.cpf ?? "").replace(/\D/g, "");
    if (!corpo.nome || corpo.nome.trim().length < 3) throw new ErroApi(422, "nome: informe o nome");
    if (cpf && !cpfValido(cpf)) throw new ErroApi(422, "cpf: CPF inválido");
    if (!id && !cpf) throw new ErroApi(422, "CPF obrigatório.");
    if (cpf && st.profs.some((p) => p.id !== id && p.cpf === cpf)) throw new ErroApi(409, "CPF já cadastrado.");
    let p = id ? st.profs.find((x) => x.id === id) : undefined;
    if (id && !p) throw new ErroApi(404, "Não encontrado");
    const habs = (corpo.habilitacoes ?? []).map((h: any) => ({ etapa: h.etapa, disciplina_id: Number(h.disciplina_id) }));
    const dados = { nome: corpo.nome.trim(), email: corpo.email || null, telefone: corpo.telefone || null, ativo: corpo.ativo !== false, suspenso_ate: corpo.suspenso_ate || null, habs };
    if (p) {
      Object.assign(p, dados);
      if (cpf) p.cpf = cpf;
    } else {
      p = { id: novoId(), cpf, vinculado: false, consentimento: false, bloqueado: false, indisp: [], ...dados };
      st.profs.push(p);
    }
    registrar(id ? "PROFESSOR_EDITADO" : "PROFESSOR_CRIADO", "professor", p.id, { ativo: p.ativo, suspenso_ate: p.suspenso_ate }, { tipo: "USUARIO", id: u.id });
    return profOut(p);
  }
  if (caminho === "/api/admin/listas") return [...st.listas].sort((a, b) => b.importada_em.localeCompare(a.importada_em));
  if (caminho === "/api/admin/listas/importar") return importar(form!, u);
  if ((r = m(/^\/api\/admin\/listas\/(\d+)\/ativar$/))) {
    const l = st.listas.find((x) => x.id === Number(r![1]));
    if (!l) throw new ErroApi(404, "Não encontrado");
    st.listas.forEach((x) => (x.ativa = x.id === l.id));
    registrar("LISTA_ATIVADA", "lista_classificacao", l.id, {}, { tipo: "USUARIO", id: u.id });
    return l;
  }
  if (caminho === "/api/admin/configuracao" && metodo === "GET") return st.config;
  if (caminho === "/api/admin/configuracao") {
    const n = (v: any, min: number, max: number, campo: string) => {
      if (v === null) return null;
      if (!Number.isInteger(v) || v < min || v > max) throw new ErroApi(422, `${campo}: valor entre ${min} e ${max}`);
      return v;
    };
    const antes = { ...st.config };
    st.config = {
      ...st.config, ...corpo,
      tamanho_onda: n(corpo.tamanho_onda, 1, 20, "tamanho_onda"), timeout_minutos: n(corpo.timeout_minutos, 1, 1440, "timeout_minutos"),
      timeout_minutos_urgente: n(corpo.timeout_minutos_urgente, 1, 1440, "timeout_minutos_urgente"),
    };
    registrar("CONFIGURACAO_ALTERADA", "configuracao", 1, { antes, depois: st.config }, { tipo: "USUARIO", id: u.id });
    return st.config;
  }
  if (caminho === "/api/admin/painel") {
    const sols = filtrar(q, null);
    return { indicadores: indicadores(sols), solicitacoes: sols.slice(0, 300).map(resumo) };
  }
  if (caminho === "/api/admin/relatorios/solicitacoes.csv") {
    const sols = filtrar(q, null);
    registrar("RELATORIO_EXPORTADO", "solicitacao", null, { linhas: sols.length }, { tipo: "USUARIO", id: u.id });
    return csv([
      ["id", "escola", "etapa", "disciplina", "turma", "turno", "periodo", "horario", "urgente", "status", "ciclo", "professor_aceito", "criada_em", "preenchida_em"],
      ...sols.map((s) => [s.id, escolaRes(s.escola_id).nome, s.etapa, nomeDisc(s.disciplina_id), s.turma, TURNOS[s.turno], periodo(s), `${s.hora_inicio}-${s.hora_fim}`, s.urgente ? "sim" : "não", s.status, s.ciclo, s.professor_aceito_id ? prof(s.professor_aceito_id).nome : "", fmtDH(s.criada_em), fmtDH(s.preenchida_em)]),
    ]);
  }
  if (caminho === "/api/admin/auditoria/verificar") {
    let anterior = "0".repeat(16);
    for (const reg of st.log) {
      if (reg.hash_anterior !== anterior || reg.hash !== hashReg(reg)) return { ok: false, total: reg.id - 1, primeiro_erro_id: reg.id, registros: st.log.length };
      anterior = reg.hash;
    }
    return { ok: true, total: st.log.length, primeiro_erro_id: null, registros: st.log.length };
  }
  if (caminho === "/api/admin/auditoria") {
    const acao = q.get("acao");
    return [...st.log].reverse().filter((x) => !acao || x.acao.includes(acao)).slice(0, Number(q.get("limite") ?? 100));
  }
  throw new ErroApi(404, "Não encontrado");
}

// ------------------------------------------------------------------ ponto de entrada
export async function chamar<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; form?: FormData } = {}): Promise<T> {
  if (!st) st = carregar();
  tick();
  const url = new URL(caminho, "http://demo");
  const metodo = opcoes.metodo ?? (opcoes.corpo !== undefined || opcoes.form ? "POST" : "GET");
  await new Promise((ok) => setTimeout(ok, 120)); // latência de rede simulada
  try {
    const r = await rotear(metodo, url.pathname, url.searchParams, opcoes.corpo ?? {}, opcoes.form);
    return JSON.parse(JSON.stringify(r)) as T;
  } finally {
    salvar();
  }
}

setInterval(tick, 1000);
