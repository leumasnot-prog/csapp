import type { ReactNode } from "react";
import { IconeAceite, IconePrazo, IconeRecusa } from "../icones";

/** Estados de uma convocação (um professor chamado numa onda). */
export type EstadoConvocacao =
  | "aguardando"
  | "aceitou"
  | "recusou"
  | "sem_resposta"
  | "vaga_preenchida"
  | "cancelada"
  | "falha_envio"
  | "conflito"
  | "pulado";

/** Estados de uma solicitação de substituição. */
export type EstadoSolicitacao = "em_convocacao" | "preenchida" | "fila_esgotada" | "cancelada" | "expirada";

type Tom = "azul" | "verde" | "vermelho" | "ambar" | "neutro" | "laranja";
type Marca = "ponto" | "aceite" | "recusa" | "prazo" | "anel";

interface Definicao { texto: string; tom: Tom; marca: Marca }

export const SELOS_CONVOCACAO: Record<EstadoConvocacao, Definicao> = {
  aguardando: { texto: "Aguardando resposta", tom: "ambar", marca: "ponto" },
  aceitou: { texto: "Aceitou", tom: "verde", marca: "aceite" },
  recusou: { texto: "Recusou", tom: "vermelho", marca: "recusa" },
  sem_resposta: { texto: "Não respondeu", tom: "ambar", marca: "anel" },
  vaga_preenchida: { texto: "Vaga preenchida por outro", tom: "neutro", marca: "anel" },
  cancelada: { texto: "Cancelada", tom: "neutro", marca: "anel" },
  falha_envio: { texto: "Falha no envio", tom: "vermelho", marca: "ponto" },
  conflito: { texto: "Conflito de agenda", tom: "neutro", marca: "ponto" },
  pulado: { texto: "Pulado", tom: "neutro", marca: "anel" },
};

export const SELOS_SOLICITACAO: Record<EstadoSolicitacao, Definicao> = {
  em_convocacao: { texto: "Em convocação", tom: "azul", marca: "ponto" },
  preenchida: { texto: "Preenchida", tom: "verde", marca: "aceite" },
  fila_esgotada: { texto: "Fila esgotada", tom: "vermelho", marca: "ponto" },
  cancelada: { texto: "Cancelada", tom: "neutro", marca: "anel" },
  expirada: { texto: "Expirada", tom: "neutro", marca: "anel" },
};

function MarcaSelo({ marca }: { marca: Marca }) {
  if (marca === "aceite") return <IconeAceite tamanho={14} />;
  if (marca === "recusa") return <IconeRecusa tamanho={14} />;
  if (marca === "prazo") return <IconePrazo tamanho={14} />;
  return <span className={`ds-selo-${marca}`} aria-hidden="true" />;
}

export type PropsSelo =
  | { convocacao: EstadoConvocacao; solicitacao?: never; urgente?: never; children?: ReactNode; className?: string }
  | { solicitacao: EstadoSolicitacao; convocacao?: never; urgente?: never; children?: ReactNode; className?: string }
  | { urgente: true; convocacao?: never; solicitacao?: never; children?: ReactNode; className?: string };

/** Selo de estado: pílula com cor E texto (o estado nunca depende só da cor). */
export function Selo(p: PropsSelo) {
  const def: Definicao = p.convocacao
    ? SELOS_CONVOCACAO[p.convocacao]
    : p.solicitacao
      ? SELOS_SOLICITACAO[p.solicitacao]
      : { texto: "Urgente", tom: "laranja", marca: "prazo" };
  return (
    <span className={["ds-selo", `ds-selo--${def.tom}`, p.className].filter(Boolean).join(" ")}>
      <MarcaSelo marca={def.marca} />
      {p.children ?? def.texto}
    </span>
  );
}
