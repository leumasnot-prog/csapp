// Fontes do design system, servidas pelo próprio painel (pacotes Fontsource).
//
// Só o subconjunto latino, que cobre o português. As famílias são registradas
// pela API FontFace e só são usadas dentro de .ds-raiz, então nada muda nas
// telas atuais. Na demonstração (um único arquivo HTML, sem pasta de assets)
// os arquivos entram embutidos como data: URL; no build normal viram arquivos
// com hash, baixados só quando esta parte do painel abre.
import dmUrl from "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url";
import dmEmbutida from "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url&inline";
import funnelUrl from "@fontsource-variable/funnel-display/files/funnel-display-latin-wght-normal.woff2?url";
import funnelEmbutida from "@fontsource-variable/funnel-display/files/funnel-display-latin-wght-normal.woff2?url&inline";

const EMBUTIR = import.meta.env.MODE === "demo";

const FAIXA_LATINA =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

let registradas = false;

export function carregarFontes() {
  if (registradas || typeof document === "undefined" || !("fonts" in document)) return;
  registradas = true;
  const fontes = [
    new FontFace("DM Sans Variable", `url(${EMBUTIR ? dmEmbutida : dmUrl}) format("woff2")`, {
      weight: "100 1000",
      style: "normal",
      display: "swap",
      unicodeRange: FAIXA_LATINA,
    }),
    new FontFace("Funnel Display Variable", `url(${EMBUTIR ? funnelEmbutida : funnelUrl}) format("woff2")`, {
      weight: "300 800",
      style: "normal",
      display: "swap",
      unicodeRange: FAIXA_LATINA,
    }),
  ];
  for (const f of fontes) {
    document.fonts.add(f);
    // Carrega já: o texto aparece na fonte de sistema e troca quando chegar.
    f.load().catch(() => {
      /* sem a fonte, fica a de sistema, que já está na pilha */
    });
  }
}
