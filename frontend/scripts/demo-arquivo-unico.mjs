// Junta o build da demonstração (dist-demo) num único HTML que abre com dois cliques,
// sem servidor: ../demo/substituicao-demo.html
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(raiz, "dist-demo");
const assets = readdirSync(join(dist, "assets"));
const js = assets.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dist, "assets", f), "utf8")).join("\n");
const css = assets.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(dist, "assets", f), "utf8")).join("\n");

const corpo = [
  `<style>${css}</style>`,
  `<div id="root"></div>`,
  `<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>`,
].join("\n");

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Substituição de Professores</title>
</head>
<body>
${corpo}
</body>
</html>
`;
const destino = join(raiz, "..", "demo", "substituicao-demo.html");
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, html);

// Versão sem <html>/<head>/<body>, para publicar como página hospedada.
if (process.argv[2]) {
  writeFileSync(process.argv[2], `<title>Substituição de Professores</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${corpo}\n`);
}
console.log(`Demonstração gerada: ${destino} (${Math.round(html.length / 1024)} KB)`);
