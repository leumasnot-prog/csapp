import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { curvaMonotona, formatarNumero, larguraTexto, limitar, marcasEixo, useLargura } from "./comum";

export interface PontoLinha {
  /** Rótulo do eixo horizontal (ex.: "07/10"). */
  rotulo: string;
  valor: number;
  /** Nome longo para leitores de tela e para a etiqueta (ex.: "semana de 7 de outubro"). */
  nome?: string;
}

export interface PropsGraficoLinha {
  titulo: string;
  /** Descrição acessível: o que o gráfico mostra e a leitura principal. */
  descricao: string;
  dados: PontoLinha[];
  /** Formata o valor da etiqueta (ex.: n => `${n} vagas`). */
  formatar?: (n: number) => string;
  /** Linha de referência tracejada, com nome (ex.: média do período). */
  referencia?: { valor: number; rotulo: string };
  /** Ponto marcado de saída (padrão: o último). */
  destaque?: number;
  altura?: number;
  /** Nome da coluna de valores na tabela acessível. */
  nomeValor?: string;
  className?: string;
}

const M = { topo: 44, direita: 20, base: 30 };

/**
 * Linha com área: traço em gradiente, marcador laranja e etiqueta de valor.
 * Passe o dedo ou o mouse para mover o marcador; pelo teclado, setas.
 */
export function GraficoLinha({ titulo, descricao, dados, formatar = formatarNumero, referencia, destaque, altura = 260, nomeValor = "Valor", className }: PropsGraficoLinha) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const padrao = destaque ?? dados.length - 1;
  const [ativo, setAtivo] = useState<number | null>(null);
  const i = ativo ?? padrao;
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const idTraco = `ds-gl-${base}-traco`;
  const idArea = `ds-gl-${base}-area`;
  const idDesc = `ds-gl-${base}-desc`;

  const max = Math.max(...dados.map((d) => d.valor), referencia?.valor ?? 0);
  const marcas = marcasEixo(max);
  const topoEixo = marcas[marcas.length - 1];
  const esquerda = Math.ceil(Math.max(...marcas.map((m) => larguraTexto(formatarNumero(m), 12, 500)))) + 12;
  const w = largura - esquerda - M.direita;
  const h = altura - M.topo - M.base;
  const x = (k: number) => esquerda + (dados.length === 1 ? w / 2 : (k / (dados.length - 1)) * w);
  const y = (v: number) => M.topo + h - (v / topoEixo) * h;
  const pts = dados.map((d, k) => [x(k), y(d.valor)] as [number, number]);
  const linha = curvaMonotona(pts);
  const area = `${linha}L${x(dados.length - 1).toFixed(2)},${(M.topo + h).toFixed(2)}L${x(0).toFixed(2)},${(M.topo + h).toFixed(2)}Z`;

  // quantos rótulos do eixo x cabem sem encostar
  const espaco = w / Math.max(1, dados.length - 1);
  const maior = Math.max(...dados.map((d) => larguraTexto(d.rotulo, 12, 500)));
  const salto = Math.max(1, Math.ceil((maior + 12) / espaco));

  const p = dados[i];
  const textoPilula = formatar(p.valor);
  const lp = larguraTexto(textoPilula, 13, 600) + 22;
  const hp = 28;
  const px = limitar(pts[i][0] - lp / 2, 0, largura - lp);
  const py = Math.max(2, pts[i][1] - hp - 14);

  function mover(e: PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - r.left;
    const k = dados.length === 1 ? 0 : Math.round(((rel - esquerda) / w) * (dados.length - 1));
    setAtivo(limitar(k, 0, dados.length - 1));
  }

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    let k = i;
    if (e.key === "ArrowRight") k = Math.min(dados.length - 1, i + 1);
    else if (e.key === "ArrowLeft") k = Math.max(0, i - 1);
    else if (e.key === "Home") k = 0;
    else if (e.key === "End") k = dados.length - 1;
    else if (e.key === "Escape") {
      setAtivo(null);
      return;
    } else return;
    e.preventDefault();
    setAtivo(k);
  }

  return (
    <figure className={["ds-grafico", className].filter(Boolean).join(" ")}>
      <figcaption className="ds-grafico-titulo">{titulo}</figcaption>
      <p className="ds-grafico-descricao" id={idDesc}>{descricao}</p>
      <div
        ref={ref}
        className="ds-grafico-area"
        tabIndex={0}
        role="group"
        aria-label={`${titulo}. Use as setas para percorrer os pontos.`}
        aria-describedby={idDesc}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
      >
        <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true" className="ds-grafico-svg">
          <defs>
            <linearGradient id={idTraco} gradientUnits="userSpaceOnUse" x1={esquerda} y1="0" x2={esquerda + w} y2="0">
              <stop offset="0" className="ds-gl-traco-ini" />
              <stop offset="1" className="ds-gl-traco-fim" />
            </linearGradient>
            <linearGradient id={idArea} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="ds-gl-area-ini" />
              <stop offset="1" className="ds-gl-area-fim" />
            </linearGradient>
          </defs>
          {/* grade e eixo y */}
          {marcas.map((m) => (
            <g key={m}>
              <line className={m === 0 ? "ds-grafico-base" : "ds-grafico-grade"} x1={esquerda} x2={esquerda + w} y1={y(m)} y2={y(m)} />
              <text className="ds-grafico-eixo" x={esquerda - 10} y={y(m)} dy="0.32em" textAnchor="end">
                {formatarNumero(m)}
              </text>
            </g>
          ))}
          {/* eixo x */}
          {dados.map((d, k) =>
            (dados.length - 1 - k) % salto === 0 ? (
              <text key={k} className="ds-grafico-eixo" x={x(k)} y={altura - 8} textAnchor="middle">
                {d.rotulo}
              </text>
            ) : null,
          )}
          {referencia && (
            <g>
              <line className="ds-grafico-referencia" x1={esquerda} x2={esquerda + w} y1={y(referencia.valor)} y2={y(referencia.valor)} />
              <text className="ds-grafico-referencia-texto" x={esquerda + 4} y={y(referencia.valor) - 6}>
                {referencia.rotulo}
              </text>
            </g>
          )}
          <path d={area} fill={`url(#${idArea})`} />
          <path d={linha} fill="none" stroke={`url(#${idTraco})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* guia, marcador e etiqueta */}
          <line className="ds-grafico-guia" x1={pts[i][0]} x2={pts[i][0]} y1={pts[i][1] + 8} y2={M.topo + h} />
          <circle className="ds-grafico-marcador" cx={pts[i][0]} cy={pts[i][1]} r="6.5" />
          <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)})`}>
            <rect className="ds-grafico-pilula" width={lp} height={hp} rx={hp / 2} />
            <text className="ds-grafico-pilula-texto" x={lp / 2} y={hp / 2} dy="0.34em" textAnchor="middle">
              {textoPilula}
            </text>
          </g>
          <rect
            x={0}
            y={0}
            width={largura}
            height={altura}
            fill="transparent"
            onPointerMove={mover}
            onPointerDown={mover}
            onPointerLeave={() => setAtivo(null)}
            style={{ touchAction: "pan-y" }}
          />
        </svg>
        <p className="ds-so-leitor" aria-live="polite">
          {ativo !== null ? `${p.nome ?? p.rotulo}: ${formatar(p.valor)}` : ""}
        </p>
      </div>
      <table className="ds-so-leitor">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">{nomeValor}</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((d, k) => (
            <tr key={k}>
              <th scope="row">{d.nome ?? d.rotulo}</th>
              <td>{formatar(d.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
