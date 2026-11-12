// A história da apresentação: uma convocação do começo ao fim, como função
// pura do progresso p (0 a 6, um inteiro por passo). Tudo o que a moldura
// mostra sai daqui, então rolar para a frente ou para trás dá sempre o mesmo
// quadro para o mesmo ponto. Nomes, escola e telefone são dados de exemplo.
import type { ConvocadoOnda, EstadoSolicitacao, ItemRegistro, PuladoOnda } from "../ds";

const HOJE = "2026-11-11";
export const as = (hhmm: string, s = 0) => Date.parse(`${HOJE}T${hhmm}:00-03:00`) + s * 1000;

export const ESCOLA = "EMEF Monteiro Lobato";
export const DISCIPLINA = "Matemática";
export const TURMA = "7º A";
export const HORARIO = "Hoje, 13:00 às 14:40";

export const ONDA1 = { enviada: as("12:52"), prazo: as("13:07") };
export const ONDA2 = { enviada: as("13:07"), prazo: as("13:22") };
const RECUSA = 2.1; // Carla recusa
const PRAZO1 = 2.8; // prazo da onda 1 acaba
export const ACEITE = 4.15; // Fábio aceita
const HORA_ACEITE = as("13:10", 24);

export const SUBSTITUTO = { nome: "Fábio Costa Almeida", telefone: "(16) 99000-4321" };

const FILA = [
  "Ana Paula Souza Oliveira",
  "Bruno Oliveira Ferreira",
  "Carla Santos Lima",
  "Diego Pereira Oliveira",
  "Elaine Lima Rodrigues",
  "Fábio Costa Almeida",
  "Gabriela Almeida Santos",
];
const MOTIVO_PULO = "já estava em outra substituição neste horário";

export interface Passo {
  /** Nome curto, no indicador de progresso. */
  curto: string;
  titulo: string;
  texto: string;
}

export const PASSOS: Passo[] = [
  {
    curto: "Pedido aberto",
    titulo: "Você abre a solicitação",
    texto: "Escola, disciplina, turma e horário. O painel olha a lista de classificação de Matemática e separa quem pode ser chamado primeiro.",
  },
  {
    curto: "Primeira onda",
    titulo: "A primeira onda sai para três professores",
    texto: "Os três primeiros que podem dar a aula recebem a convocação ao mesmo tempo, com 15 minutos para responder. Ana Paula está à frente, mas já tem outra substituição nesse horário: ela é pulada e o motivo fica escrito.",
  },
  {
    curto: "Recusa e prazo",
    titulo: "Uma recusa, dois sem resposta",
    texto: "Carla recusa. Bruno e Diego não respondem até 13:07. Ninguém fica com a vaga por omissão: a onda se encerra no prazo.",
  },
  {
    curto: "Segunda onda",
    titulo: "A segunda onda sai na mesma hora",
    texto: "Sem aceite, os três seguintes da lista são chamados juntos, com um prazo novo. Você não precisa fazer nada.",
  },
  {
    curto: "Aceite",
    titulo: "O primeiro aceite leva a vaga",
    texto: "Fábio aceita às 13:10. Elaine e Gabriela recebem o aviso de vaga preenchida, e você vê o nome e o telefone de quem vai dar a aula.",
  },
  {
    curto: "Registro",
    titulo: "Fica a prova da ordem",
    texto: "Cada professor chamado, pulado ou sem resposta fica registrado na ordem da classificação, com o horário e o motivo. Se alguém perguntar depois, a resposta está aqui.",
  },
];

/** Início e fim de cada passo em p; o fim é o quadro que fica parado. */
export const INICIO_PASSO = [0, 1, 2, 3, 4, 5];
export const FIM_PASSO = [0.9, 1.95, 2.95, 3.9, 4.7, 6];
/** Duração total da linha do tempo (6 passos e uma pausa no registro). */
export const DURACAO_HISTORIA = 6.4;

export type Camada = "fila" | "onda1" | "onda2" | "registro";
export const CAMADAS_DO_PASSO: Camada[][] = [["fila"], ["fila", "onda1"], ["onda1"], ["onda1", "onda2"], ["onda2"], ["onda2", "registro"]];

export const camadaEm = (p: number): Camada => (p < 1 ? "fila" : p < 3 ? "onda1" : p < 5 ? "onda2" : "registro");
export const passoEm = (p: number) => Math.max(0, Math.min(5, Math.floor(p)));

/** Relógio da história: anda devagar nas ondas e corre até o fim do prazo. */
const MARCOS: [number, number][] = [
  [0, as("12:51")],
  [1, as("12:52")],
  [2, as("12:55")],
  [RECUSA, as("12:55", 10)],
  [PRAZO1, as("13:07")],
  [3, as("13:07")],
  [4, as("13:10")],
  [ACEITE, HORA_ACEITE],
  [6, as("13:12")],
];
export function relogioEm(p: number) {
  for (let i = 1; i < MARCOS.length; i++) {
    const [p0, t0] = MARCOS[i - 1];
    const [p1, t1] = MARCOS[i];
    if (p <= p1) {
      const f = p1 === p0 ? 1 : Math.max(0, (p - p0) / (p1 - p0));
      return Math.floor((t0 + (t1 - t0) * f) / 1000) * 1000;
    }
  }
  return MARCOS[MARCOS.length - 1][1];
}

export function solicitacaoEm(p: number): { estado?: EstadoSolicitacao; espera: string; preenchida: boolean } {
  if (p < 0.4) return { espera: "Rascunho, ainda não enviada", preenchida: false };
  if (p < 1) return { estado: "em_convocacao", espera: "A primeira onda sai em instantes", preenchida: false };
  if (p < ACEITE) return { estado: "em_convocacao", espera: "Aguardando o primeiro aceite", preenchida: false };
  return { estado: "preenchida", espera: "", preenchida: true };
}

export function filaEm(p: number): ItemRegistro[] {
  const separada = p >= 0.5;
  return FILA.map((nome, i) => {
    const posicao = i + 1;
    if (!separada) return { posicao, nome, detalhe: "Habilitado em Matemática" };
    if (posicao === 1) return { posicao, nome, estado: "pulado", detalhe: `Pulada: ${MOTIVO_PULO}` };
    if (posicao <= 4) return { posicao, nome, detalhe: "Vai na primeira onda" };
    return { posicao, nome, detalhe: "Espera a vez" };
  });
}

export function onda1Em(p: number): ConvocadoOnda[] {
  const semResposta = p >= PRAZO1;
  const fila = (posicao: number): ConvocadoOnda =>
    semResposta
      ? { posicao, nome: FILA[posicao - 1], estado: "sem_resposta", detalhe: "Sem resposta até 13:07" }
      : { posicao, nome: FILA[posicao - 1], estado: "aguardando", detalhe: "Enviada às 12:52" };
  return [
    fila(2),
    p >= RECUSA ? { posicao: 3, nome: FILA[2], estado: "recusou", detalhe: "Recusou às 12:55" } : fila(3),
    fila(4),
  ];
}
export const PULADOS_ONDA1: PuladoOnda[] = [{ posicao: 1, nome: FILA[0], motivo: MOTIVO_PULO }];

export function onda2Em(p: number): ConvocadoOnda[] {
  const aceita = p >= ACEITE;
  const outro = (posicao: number): ConvocadoOnda =>
    aceita
      ? { posicao, nome: FILA[posicao - 1], estado: "vaga_preenchida", detalhe: "Avisada às 13:10" }
      : { posicao, nome: FILA[posicao - 1], estado: "aguardando", detalhe: "Enviada às 13:07" };
  return [
    outro(5),
    aceita ? { posicao: 6, nome: FILA[5], estado: "aceitou", detalhe: "Aceitou às 13:10" } : { posicao: 6, nome: FILA[5], estado: "aguardando", detalhe: "Enviada às 13:07" },
    outro(7),
  ];
}
export const aceiteOnda2Em = (p: number) => (p >= ACEITE ? HORA_ACEITE : undefined);

export const REGISTRO: ItemRegistro[] = [
  { posicao: 1, nome: FILA[0], estado: "pulado", detalhe: `12:52, ${MOTIVO_PULO}` },
  { posicao: 2, nome: FILA[1], estado: "sem_resposta", detalhe: "Onda 1, prazo encerrado às 13:07" },
  { posicao: 3, nome: FILA[2], estado: "recusou", detalhe: "Onda 1, recusou às 12:55" },
  { posicao: 4, nome: FILA[3], estado: "sem_resposta", detalhe: "Onda 1, prazo encerrado às 13:07" },
  { posicao: 5, nome: FILA[4], estado: "vaga_preenchida", detalhe: "Onda 2, avisada às 13:10" },
  { posicao: 6, nome: FILA[5], estado: "aceitou", detalhe: "Onda 2, aceitou às 13:10" },
  { posicao: 7, nome: FILA[6], estado: "vaga_preenchida", detalhe: "Onda 2, avisada às 13:10" },
];
