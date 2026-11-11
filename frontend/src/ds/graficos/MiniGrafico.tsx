import { curvaMonotona, useLargura } from "./comum";

export interface PropsMiniGrafico {
  valores: number[];
  /** Descrição acessível (o minigráfico é uma imagem com nome). */
  descricao: string;
  altura?: number;
  className?: string;
}

/** Minigráfico: tendência em uma linha, ponto no valor mais recente. */
export function MiniGrafico({ valores, descricao, altura = 40, className }: PropsMiniGrafico) {
  const [ref, largura] = useLargura<HTMLDivElement>(160);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pad = 6;
  const x = (k: number) => pad + (k / Math.max(1, valores.length - 1)) * (largura - pad * 2);
  const y = (v: number) => pad + (1 - (max === min ? 0.5 : (v - min) / (max - min))) * (altura - pad * 2);
  const pts = valores.map((v, k) => [x(k), y(v)] as [number, number]);
  const linha = curvaMonotona(pts);
  const ultimo = pts[pts.length - 1];
  const area = `${linha}L${ultimo[0].toFixed(2)},${altura}L${pts[0][0].toFixed(2)},${altura}Z`;
  return (
    <div ref={ref} className={["ds-mini", className].filter(Boolean).join(" ")}>
      <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={descricao}>
        <path d={area} className="ds-mini-area" />
        <path d={linha} className="ds-mini-linha" />
        <circle cx={ultimo[0]} cy={ultimo[1]} r="4" className="ds-mini-ponto" />
      </svg>
    </div>
  );
}
