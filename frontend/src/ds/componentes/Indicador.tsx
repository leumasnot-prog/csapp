import type { ReactNode } from "react";
import { MiniGrafico } from "../graficos/MiniGrafico";

export interface PropsIndicador {
  rotulo: string;
  /** Valor já formatado (ex.: "42", "7 min", "1,4"). */
  valor: ReactNode;
  /** Unidade em tamanho menor ao lado do número. */
  unidade?: string;
  /** Comparação, sempre com o período nomeado (ex.: "+6 sobre outubro"). */
  variacao?: string;
  /** Série para o minigráfico, do mais antigo ao mais recente. */
  serie?: number[];
  /** Descrição acessível do minigráfico. */
  descricaoSerie?: string;
  className?: string;
}

/** Indicador: número grande na fonte de título (Oxanium), rótulo e, se fizer sentido, um minigráfico. */
export function Indicador({ rotulo, valor, unidade, variacao, serie, descricaoSerie, className }: PropsIndicador) {
  return (
    <div className={["ds-indicador", className].filter(Boolean).join(" ")}>
      <p className="ds-indicador-rotulo">{rotulo}</p>
      <p className="ds-indicador-valor">
        {valor}
        {unidade && <span className="ds-indicador-unidade">{unidade}</span>}
      </p>
      {variacao && <p className="ds-indicador-variacao">{variacao}</p>}
      {serie && serie.length > 1 && (
        <MiniGrafico className="ds-indicador-grafico" valores={serie} descricao={descricaoSerie ?? `Evolução de ${rotulo.toLowerCase()}`} />
      )}
    </div>
  );
}
