import type { ElementType, HTMLAttributes, ReactNode } from "react";

interface PropsSuperficie extends HTMLAttributes<HTMLElement> {
  /** Elemento HTML (padrão: div; use "section" ou "article" quando fizer sentido). */
  como?: ElementType;
  children?: ReactNode;
}

export interface PropsCartao extends PropsSuperficie {
  /** Só para o que flutua de verdade (composição da apresentação): ganha a sombra única. */
  flutuante?: boolean;
}

/** Cartão: papel sobre a névoa, borda de 1px, raio de 16px. Sem sombra. */
export function Cartao({ como: Tag = "div", flutuante, className, ...resto }: PropsCartao) {
  return <Tag className={["ds-cartao", flutuante && "ds-cartao--flutuante", className].filter(Boolean).join(" ")} {...resto} />;
}

/** Painel de destaque "céu": azul muito claro, raio de 28px. Um por tela, no que importa. */
export function Painel({ como: Tag = "div", className, ...resto }: PropsSuperficie) {
  return <Tag className={["ds-painel", className].filter(Boolean).join(" ")} {...resto} />;
}
