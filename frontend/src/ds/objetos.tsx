// Objetos ilustrados do design system: peças do mundo da escola e da
// convocação, com volume (gradiente + sombra suave), para a apresentação e
// para estados vazios.
//
// Regras de desenho, iguais para todos:
// - grade de 160 × 160, objeto entre 16 e 140, sombra no chão em y ≈ 148;
// - luz sempre do alto à esquerda: gradientes vão do tom claro (alto,
//   esquerda) ao escuro (baixo, direita), com um brilho branco no canto
//   iluminado;
// - três tons por material (-1 claro, -2 base, -3 sombra), todos em tokens
//   --ds-obj-* de tokens.css; nenhuma cor literal aqui;
// - formas simples, sem contorno preto; detalhe só onde conta a história.
import { useId, type CSSProperties, type ReactNode } from "react";

export interface PropsObjeto {
  /** Lado em px (padrão 160). */
  tamanho?: number;
  /** Nome acessível. Sem ele o objeto é decorativo. */
  titulo?: string;
  className?: string;
  style?: CSSProperties;
}

type Tom = string; // sufixo de --ds-obj-*

const cor = (t: Tom) => `var(--ds-obj-${t})`;
const pinta = (t: Tom): CSSProperties => ({ fill: cor(t) });

function useIds() {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (nome: string) => `ds-obj-${base}-${nome}`;
}

/** Gradiente linear na caixa do próprio elemento (padrão: alto-esquerda → baixo-direita). */
function Grad({ id, de, ate, meio, x1 = 0, y1 = 0, x2 = 1, y2 = 1 }: { id: string; de: Tom; ate: Tom; meio?: Tom; x1?: number; y1?: number; x2?: number; y2?: number }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <stop offset="0" style={{ stopColor: cor(de) }} />
      {meio && <stop offset="0.5" style={{ stopColor: cor(meio) }} />}
      <stop offset="1" style={{ stopColor: cor(ate) }} />
    </linearGradient>
  );
}

/** Brilho: branco que some, para faixas de luz. */
function Brilho({ id, x1 = 0, y1 = 0, x2 = 1, y2 = 1, forca = 0.7 }: { id: string; x1?: number; y1?: number; x2?: number; y2?: number; forca?: number }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <stop offset="0" style={{ stopColor: cor("luz"), stopOpacity: forca }} />
      <stop offset="1" style={{ stopColor: cor("luz"), stopOpacity: 0 }} />
    </linearGradient>
  );
}

/** Sombra suave no chão, comum a todos os objetos. */
function Sombra({ id, cx = 80, cy = 148, rx = 44, ry = 7 }: { id: string; cx?: number; cy?: number; rx?: number; ry?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" style={{ stopColor: cor("sombra") }} />
          <stop offset="1" style={{ stopColor: cor("sombra"), stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
    </>
  );
}

function Moldura({ tamanho = 160, titulo, className, style, children }: PropsObjeto & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 160"
      width={tamanho}
      height={tamanho}
      className={className ? `ds-objeto ${className}` : "ds-objeto"}
      style={style}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      {titulo && <title>{titulo}</title>}
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ sino */

/** Sino de mão da escola, inclinado e com o badalo balançando: está tocando. */
export function ObjetoSino(p: PropsObjeto) {
  const id = useIds();
  return (
    <Moldura {...p}>
      <defs>
        <Grad id={id("corpo")} de="ouro-1" meio="ouro-2" ate="ouro-3" x2={1} y2={0.35} />
        <Grad id={id("boca")} de="ouro-2" ate="ouro-3" x1={0} y1={0} x2={1} y2={0} />
        <Grad id={id("cabo")} de="azul-1" meio="azul-2" ate="azul-3" x2={1} y2={0} />
        <Grad id={id("badalo")} de="metal-1" meio="metal-2" ate="metal-3" />
        <Brilho id={id("brilho")} x1={0} y1={0} x2={0} y2={1} forca={0.85} />
      </defs>
      <Sombra id={id("sombra")} cx={80} rx={42} />
      <g transform="rotate(-14 80 88)">
        {/* cabo de madeira pintada */}
        <rect x="70" y="10" width="20" height="46" rx="10" fill={`url(#${id("cabo")})`} />
        <rect x="74" y="16" width="4" height="30" rx="2" fill={`url(#${id("brilho")})`} />
        <ellipse cx="80" cy="56" rx="13" ry="5" style={pinta("ouro-3")} />
        {/* corpo */}
        <path
          d="M80 54c-17 0-26 13-27.5 31-1.3 16-5.5 25-15.5 32h86c-10-7-14.2-16-15.5-32C106 67 97 54 80 54z"
          fill={`url(#${id("corpo")})`}
        />
        {/* faixa decorativa */}
        <path d="M51.6 96c18 4 38.8 4 56.8 0" fill="none" style={{ stroke: cor("ouro-3"), strokeOpacity: 0.45 }} strokeWidth="3" strokeLinecap="round" />
        {/* brilho do lado da luz */}
        <path d="M66 66c-5 6-7 16-8 28" fill="none" style={{ stroke: cor("luz"), strokeOpacity: 0.7 }} strokeWidth="5" strokeLinecap="round" />
        {/* boca: aro e o escuro de dentro */}
        <ellipse cx="80" cy="117" rx="44" ry="8.5" fill={`url(#${id("boca")})`} />
        <ellipse cx="80" cy="117.5" rx="37" ry="5.5" style={{ fill: cor("tinta"), opacity: 0.55 }} />
        {/* badalo: haste saindo do escuro e a bola balançando para fora da boca */}
        <path d="M80 117l13 15" fill="none" style={{ stroke: cor("metal-3") }} strokeWidth="4" strokeLinecap="round" />
        <circle cx="96" cy="135" r="9" fill={`url(#${id("badalo")})`} />
        <circle cx="93" cy="132" r="2.8" style={{ fill: cor("luz"), opacity: 0.85 }} />
      </g>
      {/* linhas de toque */}
      <g fill="none" style={{ stroke: cor("laranja-2") }} strokeWidth="4" strokeLinecap="round">
        <path d="M128 48l10-8" />
        <path d="M134 66l13-2" />
        <path d="M30 44l-9-9" />
      </g>
    </Moldura>
  );
}

/* ----------------------------------------------------------------- lousa */

/** Lousa de cavalete com a onda desenhada a giz. */
export function ObjetoLousa(p: PropsObjeto) {
  const id = useIds();
  return (
    <Moldura {...p}>
      <defs>
        <Grad id={id("moldura")} de="madeira-1" meio="madeira-2" ate="madeira-3" />
        <Grad id={id("quadro")} de="lousa-1" ate="lousa-2" />
        <Brilho id={id("reflexo")} forca={0.16} x2={0.7} y2={0.9} />
      </defs>
      <Sombra id={id("sombra")} rx={54} />
      {/* pernas do cavalete, atrás */}
      <g style={{ stroke: cor("madeira-3") }} strokeWidth="6" strokeLinecap="round">
        <path d="M46 112l-10 34" />
        <path d="M114 112l10 34" />
      </g>
      <rect x="16" y="26" width="128" height="92" rx="12" fill={`url(#${id("moldura")})`} />
      <rect x="26" y="36" width="108" height="72" rx="5" fill={`url(#${id("quadro")})`} />
      <path d="M26 41a5 5 0 0 1 5-5h103v14C95 52 58 62 26 82z" fill={`url(#${id("reflexo")})`} />
      {/* giz: três chamados e a onda */}
      <g fill="none" style={{ stroke: cor("giz") }} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
        <circle cx="48" cy="58" r="6" strokeOpacity="0.95" />
        <circle cx="70" cy="58" r="6" strokeOpacity="0.95" />
        <circle cx="92" cy="58" r="6" strokeOpacity="0.95" />
        <path d="M108 57l5 5 9-10" strokeOpacity="0.95" />
        <path d="M38 88c8 0 10-9 17-9s10 12 17 12 10-12 17-12 10 9 17 9 9-5 13-7" strokeOpacity="0.8" />
      </g>
      {/* calha com o giz */}
      <rect x="22" y="114" width="116" height="8" rx="4" style={pinta("madeira-3")} />
      <rect x="92" y="108" width="20" height="7" rx="3.5" style={pinta("giz")} />
      <rect x="92" y="108" width="7" height="7" rx="3" style={pinta("papel-2")} />
    </Moldura>
  );
}

/* ------------------------------------------------------------ prancheta */

/** Prancheta de chamada: a fila com aceite, recusa e quem ainda não respondeu. */
export function ObjetoPrancheta(p: PropsObjeto) {
  const id = useIds();
  return (
    <Moldura {...p}>
      <defs>
        <Grad id={id("placa")} de="azul-1" meio="azul-2" ate="azul-3" />
        <Grad id={id("folha")} de="papel-1" ate="papel-2" x2={0.6} />
        <Grad id={id("clipe")} de="metal-1" meio="metal-2" ate="metal-3" x2={0.4} />
      </defs>
      <Sombra id={id("sombra")} rx={42} />
      <g transform="rotate(-6 80 84)">
        <rect x="34" y="22" width="92" height="120" rx="14" fill={`url(#${id("placa")})`} />
        <rect x="44" y="36" width="72" height="98" rx="6" fill={`url(#${id("folha")})`} />
        {/* linhas da chamada */}
        <g>
          <circle cx="56" cy="58" r="6" style={pinta("verde")} />
          <path d="M53.2 58.2l2 2 3.8-4" fill="none" style={{ stroke: cor("luz") }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="68" y="55" width="36" height="6" rx="3" style={pinta("metal-2")} />

          <circle cx="56" cy="78" r="6" style={pinta("vermelho")} />
          <path d="M53.6 75.6l4.8 4.8M58.4 75.6l-4.8 4.8" fill="none" style={{ stroke: cor("luz") }} strokeWidth="2" strokeLinecap="round" />
          <rect x="68" y="75" width="28" height="6" rx="3" style={pinta("metal-2")} />

          <circle cx="56" cy="98" r="5" fill="none" style={{ stroke: cor("ouro-2") }} strokeWidth="2.5" />
          <rect x="68" y="95" width="32" height="6" rx="3" style={pinta("metal-2")} />

          <circle cx="56" cy="118" r="5" fill="none" style={{ stroke: cor("metal-2") }} strokeWidth="2.5" />
          <rect x="68" y="115" width="22" height="6" rx="3" style={pinta("metal-2")} />
        </g>
        {/* presilha */}
        <rect x="56" y="28" width="48" height="14" rx="5" fill={`url(#${id("clipe")})`} />
        <path d="M64 30h-2a7 7 0 0 1 7-14h22a7 7 0 0 1 7 14h-2" fill="none" style={{ stroke: cor("metal-3") }} strokeWidth="5" strokeLinejoin="round" />
        <rect x="60" y="30" width="20" height="3" rx="1.5" style={{ fill: cor("luz"), opacity: 0.7 }} />
      </g>
    </Moldura>
  );
}

/* -------------------------------------------------------------- megafone */

/** Megafone da convocação, com as ondas de som. */
export function ObjetoMegafone(p: PropsObjeto) {
  const id = useIds();
  return (
    <Moldura {...p}>
      <defs>
        {/* cone visto de lado: luz em cima, sombra embaixo */}
        <Grad id={id("cone")} de="laranja-1" meio="laranja-2" ate="laranja-3" x1={0} y1={0} x2={0} y2={1} />
        <Grad id={id("aro")} de="laranja-1" ate="laranja-3" x1={0} y1={0} x2={1} y2={1} />
        <Grad id={id("faixa")} de="papel-1" ate="papel-2" x1={0} y1={0} x2={0} y2={1} />
        <Grad id={id("traseira")} de="azul-1" meio="azul-2" ate="azul-3" x1={0} y1={0} x2={0} y2={1} />
        <Grad id={id("cabo")} de="azul-2" ate="azul-3" x1={0} y1={0} x2={1} y2={0} />
      </defs>
      <Sombra id={id("sombra")} cx={78} rx={48} />
      <g transform="rotate(-14 80 84)">
        {/* empunhadura de pistola, presa embaixo do cone */}
        <path d="M57 96h17l-3.5 31a6.5 6.5 0 0 1-6.5 5.8h-4.4a6.5 6.5 0 0 1-6.4-7.4z" fill={`url(#${id("cabo")})`} />
        <path d="M59.5 104l-2 20" fill="none" style={{ stroke: cor("luz"), strokeOpacity: 0.45 }} strokeWidth="2.5" strokeLinecap="round" />
        {/* gatilho e o arco que o protege */}
        <path d="M74 101.5c7 1.5 10 7 8.5 14.5l-10 .5" fill="none" style={{ stroke: cor("azul-3") }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="72" y="104" width="5" height="8" rx="2.5" style={pinta("azul-2")} />
        {/* traseira arredondada e o anel que a liga ao cone */}
        <rect x="22" y="66" width="26" height="32" rx="11" fill={`url(#${id("traseira")})`} />
        <path d="M30 70.5h10" fill="none" style={{ stroke: cor("luz"), strokeOpacity: 0.55 }} strokeWidth="3" strokeLinecap="round" />
        {/* cone */}
        <path d="M44 68L116 42v80L44 96z" fill={`url(#${id("cone")})`} />
        <rect x="41" y="65.5" width="8" height="33" rx="4" style={pinta("azul-3")} />
        {/* brilho de cima, ao longo da aresta iluminada */}
        <path d="M52 69.5L108 49" fill="none" style={{ stroke: cor("luz"), strokeOpacity: 0.55 }} strokeWidth="3.5" strokeLinecap="round" />
        {/* faixa branca: um anel que abraça o cone, curvo como a boca */}
        <path d="M72 57.9A6 24.1 0 0 1 72 106.1L85 110.8A7.4 28.8 0 0 0 85 53.2z" fill={`url(#${id("faixa")})`} />
        <path d="M73.6 60.4A6 22 0 0 1 77.6 70" fill="none" style={{ stroke: cor("luz") }} strokeWidth="2" strokeLinecap="round" />
        {/* boca: aro e abertura */}
        <ellipse cx="116" cy="82" rx="11" ry="41" fill={`url(#${id("aro")})`} />
        <ellipse cx="118" cy="82" rx="7" ry="34" style={pinta("laranja-3")} />
        <ellipse cx="119.5" cy="84" rx="4" ry="25" style={{ fill: cor("tinta"), opacity: 0.35 }} />
      </g>
      {/* ondas de som */}
      <g fill="none" style={{ stroke: cor("azul-2") }} strokeWidth="5" strokeLinecap="round">
        <path d="M134 50a30 30 0 0 1 8 30" />
        <path d="M146 36a50 50 0 0 1 10 42" strokeOpacity="0.55" />
      </g>
    </Moldura>
  );
}

/* --------------------------------------------------------------- relógio */

/** Despertador do prazo: o arco laranja é o tempo que ainda resta. */
export function ObjetoRelogio(p: PropsObjeto) {
  const id = useIds();
  // arco do prazo no mostrador: do 12 até o 8 (240°), raio 28
  const r = 28;
  const fim = (240 * Math.PI) / 180;
  const ax = 80 + r * Math.sin(fim);
  const ay = 86 - r * Math.cos(fim);
  return (
    <Moldura {...p}>
      <defs>
        <Grad id={id("corpo")} de="laranja-1" meio="laranja-2" ate="laranja-3" />
        <Grad id={id("mostrador")} de="papel-1" ate="papel-2" />
        <Grad id={id("sino")} de="metal-1" meio="metal-2" ate="metal-3" />
        <Brilho id={id("brilho")} forca={0.75} x2={0.8} y2={0.8} />
      </defs>
      <Sombra id={id("sombra")} rx={42} />
      {/* pés */}
      <g style={{ stroke: cor("tinta") }} strokeWidth="7" strokeLinecap="round">
        <path d="M56 124l-8 14" />
        <path d="M104 124l8 14" />
      </g>
      {/* sinos e martelo */}
      <path d="M80 34v-10" style={{ stroke: cor("tinta") }} strokeWidth="5" strokeLinecap="round" />
      <rect x="72" y="18" width="16" height="7" rx="3.5" style={pinta("tinta")} />
      <path d="M30 52a22 22 0 0 1 32-26z" fill={`url(#${id("sino")})`} />
      <path d="M130 52a22 22 0 0 0-32-26z" fill={`url(#${id("sino")})`} />
      {/* corpo */}
      <circle cx="80" cy="86" r="48" fill={`url(#${id("corpo")})`} />
      <path d="M44 66a42 42 0 0 1 32-26" fill="none" style={{ stroke: cor("luz"), strokeOpacity: 0.6 }} strokeWidth="5" strokeLinecap="round" />
      <circle cx="80" cy="86" r="38" fill={`url(#${id("mostrador")})`} />
      {/* marcas */}
      <g style={{ stroke: cor("metal-3") }} strokeWidth="3" strokeLinecap="round">
        <path d="M80 52.5v5" />
        <path d="M113.5 86h-5" />
        <path d="M80 119.5v-5" />
        <path d="M46.5 86h5" />
      </g>
      {/* prazo restante */}
      <path
        d={`M80 ${86 - r}A${r} ${r} 0 1 1 ${ax.toFixed(2)} ${ay.toFixed(2)}`}
        fill="none"
        style={{ stroke: cor("laranja-2") }}
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* ponteiros */}
      <g style={{ stroke: cor("tinta") }} strokeLinecap="round">
        <path d="M80 86V66" strokeWidth="5" />
        <path d="M80 86l13 7" strokeWidth="5" />
      </g>
      <circle cx="80" cy="86" r="5" style={pinta("laranja-3")} />
      <ellipse cx="66" cy="68" rx="16" ry="10" transform="rotate(-35 66 68)" fill={`url(#${id("brilho")})`} />
    </Moldura>
  );
}

/* ------------------------------------------------------------ calendário */

/** Calendário de mesa com o dia da aula marcado. */
export function ObjetoCalendario(p: PropsObjeto) {
  const id = useIds();
  const dias: [number, number][] = [];
  for (let l = 0; l < 4; l++) for (let c = 0; c < 5; c++) dias.push([46 + c * 17, 82 + l * 13]);
  return (
    <Moldura {...p}>
      <defs>
        <Grad id={id("folha")} de="papel-1" ate="papel-2" x2={0.5} />
        <Grad id={id("topo")} de="azul-1" meio="azul-2" ate="azul-3" x2={1} y2={0.6} />
        <Grad id={id("argola")} de="metal-1" meio="metal-2" ate="metal-3" x2={1} y2={0} />
      </defs>
      <Sombra id={id("sombra")} rx={50} />
      {/* folhas de baixo, dando espessura */}
      <rect x="32" y="40" width="104" height="100" rx="14" style={pinta("papel-2")} />
      <rect x="28" y="34" width="104" height="102" rx="14" fill={`url(#${id("folha")})`} />
      {/* faixa do mês */}
      <path d="M28 48a14 14 0 0 1 14-14h76a14 14 0 0 1 14 14v18H28z" fill={`url(#${id("topo")})`} />
      <rect x="40" y="52" width="40" height="6" rx="3" style={{ fill: cor("luz"), opacity: 0.85 }} />
      {/* argolas */}
      <rect x="52" y="22" width="9" height="22" rx="4.5" fill={`url(#${id("argola")})`} />
      <rect x="99" y="22" width="9" height="22" rx="4.5" fill={`url(#${id("argola")})`} />
      {/* dias */}
      {dias.map(([x, y], i) => (
        <rect key={i} x={x - 4} y={y - 4} width="8" height="8" rx="2.5" style={{ fill: cor(i === 7 ? "azul-2" : "metal-2"), opacity: i === 7 ? 1 : 0.55 }} />
      ))}
      {/* dia marcado */}
      <circle cx={dias[13][0]} cy={dias[13][1]} r="9" fill="none" style={{ stroke: cor("laranja-2") }} strokeWidth="3.5" />
    </Moldura>
  );
}

/* ---------------------------------------------------------------- mochila */

/** Mochila escolar: alças das costas com fivela, bolso da frente e zíper com puxador. */
export function ObjetoMochila(p: PropsObjeto) {
  const id = useIds();
  return (
    <Moldura {...p}>
      <defs>
        <Grad id={id("corpo")} de="azul-1" meio="azul-2" ate="azul-3" x2={0.9} y2={0.8} />
        <Grad id={id("bolso")} de="azul-1" ate="azul-2" x2={0.7} />
        <Grad id={id("alca")} de="azul-2" ate="azul-3" x1={0} y1={0} x2={1} y2={0} />
        <Grad id={id("metal")} de="metal-1" meio="metal-2" ate="metal-3" />
        <Grad id={id("puxador")} de="laranja-1" ate="laranja-3" x1={0} y1={0} x2={1} y2={1} />
        <Brilho id={id("brilho")} forca={0.55} x2={1} y2={0.3} />
      </defs>
      <Sombra id={id("sombra")} rx={50} />
      {/* alça de mão */}
      <path d="M66 38V30a14 14 0 0 1 28 0v8" fill="none" style={{ stroke: cor("azul-3") }} strokeWidth="7" strokeLinecap="round" />
      {/* alças das costas: tiras largas que saem de trás, descem e voltam embaixo */}
      <path d="M52 50C30 56 20 92 27 130l12 1c-5-32-1-62 15-74z" fill={`url(#${id("alca")})`} />
      <path d="M108 50c22 6 32 42 25 80l-12 1c5-32 1-62-15-74z" fill={`url(#${id("alca")})`} />
      <path d="M38 64c-9 14-11 38-7 62" fill="none" style={{ stroke: cor("azul-1"), strokeOpacity: 0.7 }} strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />
      {/* fivelas de ajuste */}
      <rect x="24" y="108" width="15" height="8" rx="2.5" transform="rotate(-4 31 112)" fill={`url(#${id("metal")})`} />
      <rect x="121" y="108" width="15" height="8" rx="2.5" transform="rotate(4 129 112)" fill={`url(#${id("metal")})`} />
      {/* corpo */}
      <path d="M80 34c-24 0-38 12-38 32v58c0 9 6 16 15 16h46c9 0 15-7 15-16V66c0-20-14-32-38-32z" fill={`url(#${id("corpo")})`} />
      <path d="M50 64c2-12 12-20 28-21" fill="none" style={{ stroke: cor("luz"), strokeOpacity: 0.5 }} strokeWidth="4" strokeLinecap="round" />
      {/* tampa, com o zíper de cima */}
      <path d="M44 74c22 6 50 6 72 0" fill="none" style={{ stroke: cor("azul-3"), strokeOpacity: 0.55 }} strokeWidth="3" strokeLinecap="round" />
      {/* bolso da frente */}
      <rect x="50" y="90" width="60" height="42" rx="14" fill={`url(#${id("bolso")})`} />
      <rect x="54" y="92" width="30" height="5" rx="2.5" fill={`url(#${id("brilho")})`} />
      {/* zíper do bolso: dentes, cursor de metal e o puxador laranja pendurado */}
      <path d="M58 103h44" fill="none" style={{ stroke: cor("azul-3"), strokeOpacity: 0.75 }} strokeWidth="3" strokeDasharray="2 2" />
      <rect x="86" y="99.5" width="9" height="7" rx="2" fill={`url(#${id("metal")})`} />
      <path d="M90.5 106.5v3" fill="none" style={{ stroke: cor("metal-3") }} strokeWidth="2" strokeLinecap="round" />
      <path d="M86.5 109.5h8l1.5 12a4.5 4.5 0 0 1-4.5 5h-2a4.5 4.5 0 0 1-4.5-5z" transform="rotate(8 90.5 109.5)" fill={`url(#${id("puxador")})`} />
      <path d="M88.3 112.5l.6 7" transform="rotate(8 90.5 109.5)" fill="none" style={{ stroke: cor("luz"), strokeOpacity: 0.6 }} strokeWidth="1.6" strokeLinecap="round" />
    </Moldura>
  );
}

/* ---------------------------------------------------------------- celular */

/** Celular do professor com a mensagem de convocação e os botões de resposta. */
export function ObjetoCelular(p: PropsObjeto) {
  const id = useIds();
  const texto: CSSProperties = { fontFamily: "var(--ds-fonte-texto)", fontWeight: 600 };
  return (
    <Moldura {...p}>
      <defs>
        <Grad id={id("casca")} de="metal-3" ate="tinta" x2={0.8} y2={0.9} />
        <Grad id={id("tela")} de="tela" ate="papel-2" x1={0} y1={0} x2={0} y2={1} />
        <Grad id={id("aviso")} de="laranja-1" ate="laranja-3" />
      </defs>
      <Sombra id={id("sombra")} rx={40} />
      <g transform="rotate(8 80 80)">
        <rect x="42" y="12" width="76" height="134" rx="17" fill={`url(#${id("casca")})`} />
        <rect x="48" y="18" width="64" height="122" rx="12" fill={`url(#${id("tela")})`} />
        <rect x="70" y="23" width="20" height="5" rx="2.5" style={pinta("tinta")} />
        {/* mensagem */}
        <rect x="53" y="38" width="54" height="56" rx="9" style={pinta("papel-1")} />
        <text x="59" y="51" style={{ ...texto, fill: cor("tinta") }} fontSize="7.5">Convocação</text>
        <rect x="59" y="57" width="40" height="4" rx="2" style={pinta("metal-2")} />
        <rect x="59" y="65" width="32" height="4" rx="2" style={pinta("metal-2")} />
        <rect x="59" y="73" width="36" height="4" rx="2" style={pinta("metal-2")} />
        <rect x="59" y="81" width="22" height="4" rx="2" style={{ fill: cor("laranja-2"), opacity: 0.85 }} />
        {/* respostas */}
        <rect x="53" y="100" width="26" height="14" rx="7" style={pinta("verde")} />
        <text x="66" y="109.6" textAnchor="middle" style={{ ...texto, fill: cor("luz") }} fontSize="6.5">Aceito</text>
        <rect x="81" y="100" width="26" height="14" rx="7" style={pinta("papel-1")} />
        <text x="94" y="109.6" textAnchor="middle" style={{ ...texto, fill: cor("tinta") }} fontSize="6.5">Recuso</text>
        <rect x="68" y="130" width="24" height="3" rx="1.5" style={{ fill: cor("tinta"), opacity: 0.5 }} />
        {/* reflexo na casca */}
        <path d="M46 40V30a14 14 0 0 1 10-13" fill="none" style={{ stroke: cor("luz"), strokeOpacity: 0.35 }} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {/* aviso de nova mensagem */}
      <circle cx="122" cy="26" r="12" fill={`url(#${id("aviso")})`} />
      <text x="122" y="30.5" textAnchor="middle" style={{ ...texto, fill: cor("luz") }} fontSize="12">1</text>
    </Moldura>
  );
}

/** Catálogo, para a página do design system. */
export const OBJETOS = [
  { nome: "Sino", Objeto: ObjetoSino },
  { nome: "Lousa", Objeto: ObjetoLousa },
  { nome: "Prancheta de chamada", Objeto: ObjetoPrancheta },
  { nome: "Megafone", Objeto: ObjetoMegafone },
  { nome: "Relógio", Objeto: ObjetoRelogio },
  { nome: "Calendário", Objeto: ObjetoCalendario },
  { nome: "Mochila", Objeto: ObjetoMochila },
  { nome: "Celular com a convocação", Objeto: ObjetoCelular },
] as const;
