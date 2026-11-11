// Movimento do design system: GSAP com useGSAP, só transform e opacity,
// 150 a 250ms, e nada quando o aparelho pede menos movimento.
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export const DURACAO = { rapida: 0.15, media: 0.2, lenta: 0.25 } as const;
export const CURVA_SAIDA = "expo.out";

/** Condição usada em gsap.matchMedia(): só anima quem não pediu menos movimento. */
export const COM_MOVIMENTO = "(prefers-reduced-motion: no-preference)";

export function prefereMenosMovimento() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, useGSAP };
