import { useId } from "react";
import { formatarNumero, larguraTexto, useLargura } from "./comum";

export interface ItemBarra {
  rotulo: string;
  valor: number;
}

export interface PropsGraficoBarras {
  titulo: string;
  descricao: string;
  dados: ItemBarra[];
  formatar?: (n: number) => string;
  /** Índice da barra em destaque (as outras ficam no azul claro). Sem ele, todas são azuis. */
  destaque?: number;
  /** Nome da coluna de valores na tabela acessível. */
  nomeValor?: string;
  className?: string;
}

const ESPESSURA = 16; // <= 24px
const LINHA = 54; // rótulo acima + barra + respiro

/** Caminho de barra horizontal: base reta, ponta com raio de 4px. */
function barra(x0: number, y0: number, comp: number, alt: number, r = 4) {
  if (comp <= 0) return "";
  const rr = Math.min(r, comp, alt / 2);
  const x1 = x0 + comp;
  return `M${x0},${y0}H${x1 - rr}A${rr},${rr} 0 0 1 ${x1},${y0 + rr}V${y0 + alt - rr}A${rr},${rr} 0 0 1 ${x1 - rr},${y0 + alt}H${x0}Z`;
}

/**
 * Barras horizontais: rótulo acima de cada barra (cabe no celular sem cortar
 * nome de escola) e o valor na ponta.
 */
export function GraficoBarras({ titulo, descricao, dados, formatar = formatarNumero, destaque, nomeValor = "Valor", className }: PropsGraficoBarras) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const idDesc = `ds-gb-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-desc`;
  const max = Math.max(1, ...dados.map((d) => d.valor));
  const espacoValor = Math.ceil(Math.max(...dados.map((d) => larguraTexto(formatar(d.valor), 14, 600)))) + 10;
  const util = largura - espacoValor;
  const altura = dados.length * LINHA;

  return (
    <figure className={["ds-grafico", className].filter(Boolean).join(" ")}>
      <figcaption className="ds-grafico-titulo">{titulo}</figcaption>
      <p className="ds-grafico-descricao" id={idDesc}>{descricao}</p>
      <div ref={ref} className="ds-grafico-area">
        <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo} aria-describedby={idDesc} className="ds-grafico-svg">
          {dados.map((d, k) => {
            const y0 = k * LINHA;
            const comp = (d.valor / max) * util;
            const fraca = destaque !== undefined && destaque !== k;
            return (
              <g key={d.rotulo}>
                <text className="ds-grafico-rotulo" x={0} y={y0 + 14}>{d.rotulo}</text>
                <rect className="ds-grafico-trilho" x={0} y={y0 + 24} width={util} height={ESPESSURA} rx={4} />
                <path className={fraca ? "ds-grafico-barra ds-grafico-barra--fraca" : "ds-grafico-barra"} d={barra(0, y0 + 24, comp, ESPESSURA)} />
                <text className="ds-grafico-valor" x={comp + 8} y={y0 + 24 + ESPESSURA / 2} dy="0.34em">
                  {formatar(d.valor)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <table className="ds-so-leitor">
        <caption>{titulo}</caption>
        <thead>
          <tr><th scope="col">Item</th><th scope="col">{nomeValor}</th></tr>
        </thead>
        <tbody>
          {dados.map((d) => (
            <tr key={d.rotulo}><th scope="row">{d.rotulo}</th><td>{formatar(d.valor)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
