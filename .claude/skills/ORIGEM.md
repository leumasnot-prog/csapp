# Origem das skills deste projeto

Skills de terceiros copiadas em 11/11/2026 para apoiar o trabalho de front-end e
design system. Só entraram arquivos de texto (instruções em Markdown e licenças).
Nenhum script ou binário de terceiros foi copiado ou executado.

| Pasta | Origem | Commit | Licença | Para que serve |
|---|---|---|---|---|
| `frontend-design/` | github.com/anthropics/skills (`skills/frontend-design`) | `2c5958e` | ver `LICENSE.txt` | Direção visual: paleta, tipografia e layout sem cara de modelo pronto |
| `impeccable/` | github.com/pbakaus/impeccable (`.claude/skills/impeccable`) | `c1e0e54` (v4.8.2) | Apache-2.0 | Comandos de design: `shape`, `critique`, `audit`, `polish`, `typeset`, `animate`, `document`/`extract` (DESIGN.md) |
| `gsap-core/`, `gsap-timeline/`, `gsap-scrolltrigger/`, `gsap-react/`, `gsap-performance/`, `gsap-plugins/`, `gsap-utils/` | github.com/greensock/gsap-skills (`skills/`) | `aed9cfd` | MIT | Uso correto do GSAP: animações, linhas do tempo e animação ligada à rolagem, em React |

## O que ficou de fora, de propósito

- **`impeccable/scripts/`**: o lançador baixa um binário da internet e pode instalar
  hooks que rodam a cada edição. A skill funciona sem ele: quando o lançador não
  existe, ela mesma manda ler `PRODUCT.md` e `DESIGN.md` direto. Para a versão
  completa, use o instalador oficial em impeccable.style na sua máquina.
- **`gsap-frameworks/`**: trata de Vue e Svelte; o projeto é React.

## Avaliadas e não instaladas

- **hallmark** (github.com/Nutlope/hallmark): voltada a páginas novas de divulgação,
  com regras fixas que entram em conflito com as duas skills de design acima.
  Vale reavaliar se fizermos uma página de apresentação do sistema.
- **oil-motion** (github.com/oil-oil/oil-motion): gera vídeo e sequências de imagens
  com IA para animar na rolagem. Exige chave paga de um serviço externo (ZenMux),
  Python e ffmpeg. Só faz sentido para uma animação de destaque numa página de
  apresentação.
- **open-design** (github.com/nexu-io/open-design): pela descrição, é um aplicativo
  de design e não uma skill. O código não foi analisado.
- As demais da lista (vídeo, 3D, jogos) não foram analisadas: não se aplicam a um
  painel web.

## Como atualizar

Copie de novo as mesmas pastas do repositório de origem e revise as diferenças
antes de confirmar: uma skill é um conjunto de instruções que o assistente segue.
