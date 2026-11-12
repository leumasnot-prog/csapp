# Briefing visual do painel

Ponto de partida para o design system. Reúne o que foi pedido, o que já está
instalado e o que falta decidir. Contexto do produto: [`PRODUCT.md`](../../PRODUCT.md).

## O que foi pedido

Referências de site:

- https://visorfinance.app/
- https://x.ai/bot
- https://sevalla.com/

O que agrada nelas, nas palavras de quem pediu:

- presença de **gráficos**;
- **letras arredondadas**;
- **ícones flutuantes originais**, não genéricos;
- **animação ligada à rolagem**.

As três foram analisadas em 11/11/2026 (medidas de fonte, cor e raio, e capturas de
tela). A direção que saiu delas está em [`DESIGN.md`](../../DESIGN.md).

## Onde cada pedido cabe

O painel tem dois tipos de tela, com pesos diferentes:

| Tela | Quem usa | Como tratar |
|---|---|---|
| Entrada (login) e, se houver, página de apresentação | Qualquer pessoa, primeira impressão | Aqui cabem a animação de rolagem, a composição com ícones flutuantes e o gráfico em destaque |
| Operação: solicitações, nova solicitação, acompanhamento | Diretor, no celular, com pressa | Clareza primeiro. Movimento só como resposta a uma ação: onda nova, aceite, prazo correndo |
| Gestão: painel geral, relatórios, classificação, regras | Secretaria, no computador | Gráficos de verdade (preenchimento, tempo até aceitar, convocações por resultado), tabelas legíveis |

Animação de rolagem em tela de operação atrapalha quem está com pressa. Por isso
ela fica restrita à entrada e à apresentação.

## Já instalado

- **Oxanium** e **DM Sans** (pacotes `@fontsource-variable`).
- **GSAP 3.15** e **@gsap/react 2.1** em `frontend/`. Gratuito, inclusive os plugins
  (ScrollTrigger, SplitText). Licença própria do GSAP, que permite uso comercial.
- Skills em `.claude/skills/`: `frontend-design`, `impeccable` e sete do GSAP.
  Origem e critérios em [`.claude/skills/ORIGEM.md`](../../.claude/skills/ORIGEM.md).

## Decisões tomadas depois de ver as referências

| Decisão | Escolha | Por quê |
|---|---|---|
| Tema | Claro e escuro, definidos por tokens | O painel já segue o tema do aparelho |
| Fonte | Oxanium nos títulos e números grandes, DM Sans no restante (usada pela Visor), servidas pelo próprio sistema via Fontsource | A Oxanium, mais quadrada, foi escolhida entre cinco opções depois da primeira entrega, no lugar da Funnel Display; licença aberta (OFL); não envia o endereço de quem acessa a terceiros |
| Gráficos | SVG próprio, ligado aos tokens | O gráfico da Visor (traço em gradiente, marcador e etiqueta de valor) não sai de biblioteca pronta; são poucos tipos de gráfico. Recharts fica como alternativa se faltar interatividade |
| Ícones | Conjunto próprio em SVG, desenhado para o vocabulário do produto (escola, onda, convocação, prazo, aceite, recusa, lista, relatório) | Pedido explícito: nada de biblioteca genérica |
| Componentes acessíveis (diálogo, seleção, abas) | Radix quando o componente exigir | Teclado e leitor de tela corretos sem reescrever tudo |
| Estilo | CSS com variáveis (tokens), sem framework de CSS | Os dois códigos em avaliação usam CSS puro; o design system fica portável |

## Primeira entrega proposta

Tudo aditivo: nenhuma tela atual muda até a direção ser aprovada.

1. `DESIGN.md` na raiz, com a direção escolhida (cores, tipografia, raio, sombra,
   movimento) no formato que a skill `impeccable` lê.
2. `frontend/src/ds/`: tokens em CSS, fonte, e os componentes de base (botão,
   campo, cartão, selo de estado, diálogo, tabela, indicador numérico).
3. Conjunto inicial de ícones próprios.
4. Componentes de gráfico (área, barras, rosca, minigráfico) ligados aos tokens.
5. Uma rota `/design-system` que mostra tudo isso junto, em claro e escuro, no
   celular e no computador.
6. Uma proposta de tela de entrada com a composição de ícones e a animação de
   rolagem, para aprovar antes de aplicar.

Depois da aprovação: migrar as telas atuais para os componentes, uma de cada vez.

## Divisão do trabalho

- Análise, escolha de bibliotecas e revisão: Fable 5.2.
- Execução (código do design system e das telas): Opus 5.5.
