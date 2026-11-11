// Peças comuns aos gráficos: largura do contêiner, escalas, marcas do eixo,
// curva monotônica e formatação em pt-BR.
import { useLayoutEffect, useRef, useState } from "react";

/** Mede a largura do contêiner e acompanha mudanças (o gráfico se ajusta, o texto não encolhe). */
export function useLargura<T extends HTMLElement>(inicial = 600) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(160, Math.floor(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
export const formatarNumero = (n: number) => NUMERO.format(n);
const PORCENTO = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
export const formatarPorcento = (n: number) => PORCENTO.format(n);

/** Marcas "redondas" do eixo entre 0 e o máximo (1, 2, 2,5 ou 5 × 10^n). */
export function marcasEixo(max: number, alvo = 4) {
  if (max <= 0) return [0, 1];
  const bruto = max / alvo;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? 10 * pot;
  const topo = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = 0; v <= topo + passo / 1e6; v += passo) marcas.push(Number(v.toFixed(6)));
  return marcas;
}

/**
 * Caminho suave que não passa do valor real entre os pontos (Fritsch–Carlson):
 * a curva nunca inventa um pico ou vale que os dados não têm.
 */
export function curvaMonotona(pts: [number, number][]) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += `C${(x0 + h).toFixed(2)},${(y0 + t[i] * h).toFixed(2)} ${(x1 - h).toFixed(2)},${(y1 - t[i + 1] * h).toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

let contexto: CanvasRenderingContext2D | null | undefined;
/** Largura aproximada de um texto, para posicionar etiquetas sem cortar. */
export function larguraTexto(texto: string, tamanhoPx: number, peso = 600) {
  if (contexto === undefined) contexto = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (contexto) {
    contexto.font = `${peso} ${tamanhoPx}px 'DM Sans Variable', system-ui, sans-serif`;
    return contexto.measureText(texto).width;
  }
  return texto.length * tamanhoPx * 0.6;
}

export const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Cor de marca a partir de um nome de token (nunca uma cor literal). */
export type CorSerie = "azul" | "azul-claro" | "verde" | "vermelho" | "ambar" | "neutro" | "laranja";
export const corToken = (c: CorSerie) => `var(--ds-${c})`;
