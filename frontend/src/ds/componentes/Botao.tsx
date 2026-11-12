import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type VarianteBotao = "primario" | "secundario" | "perigo" | "texto";
export type TamanhoBotao = "compacto" | "normal" | "grande";

export interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  /** compacto: 36px visíveis, mas a área de toque continua com 44px. */
  tamanho?: TamanhoBotao;
  /** Mostra o indicador de progresso, bloqueia o clique e troca o texto se `textoCarregando` vier. */
  carregando?: boolean;
  textoCarregando?: string;
  icone?: ReactNode;
  iconeFim?: ReactNode;
  largo?: boolean;
}

/** Classes do botão, para um link que tem cara de botão (ex.: "Entrar" que leva a outra página). */
export function classesBotao({ variante = "primario", tamanho = "normal", largo }: { variante?: VarianteBotao; tamanho?: TamanhoBotao; largo?: boolean } = {}) {
  return ["ds-botao", `ds-botao--${variante}`, `ds-botao--${tamanho}`, largo && "ds-botao--largo"].filter(Boolean).join(" ");
}

/** Botão do design system: primário (azul), secundário (neutro), perigo (vermelho) e texto. */
export const Botao = forwardRef<HTMLButtonElement, PropsBotao>(function Botao(
  { variante = "primario", tamanho = "normal", carregando = false, textoCarregando, icone, iconeFim, largo, className, children, disabled, type = "button", ...resto },
  ref,
) {
  const classes = ["ds-botao", `ds-botao--${variante}`, `ds-botao--${tamanho}`, largo && "ds-botao--largo", carregando && "ds-botao--carregando", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || carregando} aria-busy={carregando || undefined} {...resto}>
      {carregando ? <span className="ds-botao-giro" aria-hidden="true" /> : icone}
      <span className="ds-botao-texto">{carregando && textoCarregando ? textoCarregando : children}</span>
      {!carregando && iconeFim}
    </button>
  );
});
