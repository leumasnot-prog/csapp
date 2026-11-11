import { useId, useState } from "react";
import { corToken, formatarNumero, formatarPorcento, type CorSerie } from "./comum";

export interface FatiaRosca {
  rotulo: string;
  valor: number;
  /** Cor por token. Para estados, use a cor do estado (verde aceitou etc.). */
  cor: CorSerie;
}

export interface PropsGraficoRosca {
  titulo: string;
  descricao: string;
  dados: FatiaRosca[];
  /** Nome do total no centro (ex.: "convocações"). */
  rotuloTotal: string;
  className?: string;
}

const R = 78;
const ESPESSURA = 22;
const FOLGA = 2; // px de superfície entre fatias

function arco(a0: number, a1: number, r: number) {
  const p = (a: number) => [100 + r * Math.sin(a), 100 - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

/** Rosca com legenda sempre visível (nome, quantidade e parte do total). */
export function GraficoRosca({ titulo, descricao, dados, rotuloTotal, className }: PropsGraficoRosca) {
  const [foco, setFoco] = useState<number | null>(null);
  const idDesc = `ds-gr-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-desc`;
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const folga = FOLGA / R;
  let acumulado = 0;
  const fatias = dados.map((d) => {
    const a0 = (acumulado / total) * 2 * Math.PI;
    acumulado += d.valor;
    const a1 = (acumulado / total) * 2 * Math.PI;
    return { ...d, a0: a0 + folga / 2, a1: a1 - folga / 2 };
  });

  return (
    <figure className={["ds-grafico", "ds-rosca", className].filter(Boolean).join(" ")}>
      <figcaption className="ds-grafico-titulo">{titulo}</figcaption>
      <p className="ds-grafico-descricao" id={idDesc}>{descricao}</p>
      <div className="ds-rosca-corpo">
        <svg viewBox="0 0 200 200" className="ds-rosca-svg" role="img" aria-label={`${titulo}: ${dados.map((d) => `${d.rotulo}, ${d.valor}`).join("; ")}`} aria-describedby={idDesc}>
          {fatias.map((f, k) =>
            f.valor > 0 ? (
              <path
                key={f.rotulo}
                d={arco(f.a0, Math.max(f.a0 + 0.001, f.a1), R)}
                fill="none"
                style={{ stroke: corToken(f.cor), opacity: foco === null || foco === k ? 1 : 0.35 }}
                strokeWidth={foco === k ? ESPESSURA + 4 : ESPESSURA}
                className="ds-rosca-fatia"
              />
            ) : null,
          )}
          <text x="100" y="98" textAnchor="middle" className="ds-rosca-total">{formatarNumero(total)}</text>
          <text x="100" y="122" textAnchor="middle" className="ds-rosca-total-rotulo">{rotuloTotal}</text>
        </svg>
        <ul className="ds-legenda">
          {dados.map((d, k) => (
            <li key={d.rotulo} onPointerEnter={() => setFoco(k)} onPointerLeave={() => setFoco(null)}>
              <span className="ds-legenda-marca" style={{ background: corToken(d.cor) }} aria-hidden="true" />
              <span className="ds-legenda-nome">{d.rotulo}</span>
              <span className="ds-legenda-valor">{formatarNumero(d.valor)}</span>
              <span className="ds-legenda-parte">{formatarPorcento(total ? d.valor / total : 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
