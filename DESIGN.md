---
name: Substituições
description: Painel de convocação de professores substitutos da rede municipal
colors:
  tinta: "#0e1320"
  tinta-suave: "#5a6477"
  papel: "#ffffff"
  nevoa: "#f6f8fc"
  ceu: "#e9f1fe"
  linha: "#dfe5ef"
  azul: "#1f4fe0"
  azul-profundo: "#0b2a8f"
  azul-claro: "#8fb4ff"
  laranja: "#f97316"
  laranja-texto: "#b4500b"
  verde: "#0f8a4b"
  verde-fundo: "#dcf5e7"
  vermelho: "#d1343b"
  vermelho-fundo: "#fde6e7"
  ambar-texto: "#8a5300"
  ambar-fundo: "#fff1d6"
  neutro-fundo: "#edf0f5"
typography:
  display:
    fontFamily: "'Funnel Display Variable', 'DM Sans Variable', system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  titulo:
    fontFamily: "'Funnel Display Variable', 'DM Sans Variable', system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  corpo:
    fontFamily: "'DM Sans Variable', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  rotulo:
    fontFamily: "'DM Sans Variable', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0em"
rounded:
  controle: "10px"
  cartao: "16px"
  painel: "28px"
  pilula: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
  12: "48px"
  16: "64px"
components:
  botao-primario:
    backgroundColor: "{colors.azul}"
    textColor: "{colors.papel}"
    rounded: "{rounded.controle}"
    padding: "12px 20px"
    height: "44px"
  botao-primario-hover:
    backgroundColor: "{colors.azul-profundo}"
  botao-secundario:
    backgroundColor: "{colors.neutro-fundo}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.controle}"
  cartao:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.cartao}"
    padding: "20px"
  painel-destaque:
    backgroundColor: "{colors.ceu}"
    rounded: "{rounded.painel}"
  selo-aceitou:
    backgroundColor: "{colors.verde-fundo}"
    textColor: "{colors.verde}"
    rounded: "{rounded.pilula}"
  selo-recusou:
    backgroundColor: "{colors.vermelho-fundo}"
    textColor: "{colors.vermelho}"
    rounded: "{rounded.pilula}"
  selo-aguardando:
    backgroundColor: "{colors.ambar-fundo}"
    textColor: "{colors.ambar-texto}"
    rounded: "{rounded.pilula}"
---

## Overview

Painel de trabalho de uma rede municipal de ensino. O diretor abre uma vaga no
celular, com pressa; a Secretaria acompanha a rede no computador. O visual é claro,
amigável e direto: fundo branco, superfícies em azul muito claro, texto quase preto,
um azul vivo para a ação principal e laranja reservado para prazo e urgência.

Vem de três referências escolhidas por quem encomendou o trabalho:

- **Visor (visorfinance.app):** fundo claro, cartões em azul pálido com cantos bem
  arredondados, gráfico de linha com gradiente, marcador e etiqueta de valor, objetos
  ilustrados com volume flutuando em volta do cartão principal.
- **Grok Bot (x.ai/bot):** muito branco, preto como cor de ação, botões em pílula,
  personagens simples e coloridos como ícones, a interface do produto mostrada como
  peça central.
- **Sevalla (sevalla.com):** título grande em Funnel Display com peso leve e
  espaçamento apertado, laranja como acento, e uma tela do produto fixa que troca de
  conteúdo conforme a rolagem.

**O elemento que só este produto tem é a onda:** três professores chamados ao mesmo
tempo, um prazo correndo e o primeiro aceite levando a vaga. Ela aparece como
componente no acompanhamento, como peça central da apresentação e como motivo dos
gráficos. É onde o design gasta sua ousadia; o resto fica quieto.

## Colors

- **Tinta `#0e1320`** para texto e **tinta suave `#5a6477`** para texto de apoio.
- **Papel `#ffffff`** para cartões, **névoa `#f6f8fc`** para o fundo da página e
  **céu `#e9f1fe`** para painéis de destaque. **Linha `#dfe5ef`** para bordas.
- **Azul `#1f4fe0`** é a ação principal, o estado "em convocação" e a série principal
  dos gráficos. **Azul profundo `#0b2a8f`** no hover e em fundos escuros de destaque.
  **Azul claro `#8fb4ff`** como série secundária.
- **Laranja `#f97316`** só para prazo e urgência: anel de contagem, selo "urgente",
  marcador do gráfico. Em texto, usar `#b4500b`.
- Estados da convocação: **verde** aceitou, **vermelho** recusou, **âmbar**
  aguardando ou não respondeu, **neutro** pulado, vaga preenchida por outro, cancelada.
  O estado nunca depende só da cor: sempre há texto.
- Tema escuro: fundo `#0b1020`, superfície `#131a2e`, superfície elevada `#1b2540`,
  texto `#e8ecf5`, texto de apoio `#9aa6bd`, linha `#2a3552`, azul `#6f97ff` com
  texto escuro por cima. As cores de estado clareiam e os fundos de estado escurecem.
- Os tokens ficam em `frontend/src/ds/tokens.css`. Nenhuma cor literal fora desse
  arquivo.

## Typography

- **Funnel Display** (variável, 300 a 800) em títulos e números grandes, peso 600,
  espaçamento entre letras de -0,03em nos tamanhos grandes e -0,015em nos médios.
- **DM Sans** (variável) em todo o resto: 400 no corpo, 500 em rótulos e botões, 600
  em ênfase.
- As duas são servidas pelo próprio sistema (pacotes Fontsource), sem chamada a
  servidor de fontes externo.
- Escala em rem: 0,75 · 0,875 · 1 · 1,125 · 1,375 · 1,75 · 2,25 · 3 · 4.
- Números em tabelas, prazos e indicadores usam algarismos tabulares.
- Rótulos em caixa normal, sem maiúsculas espaçadas. Sem palavra isolada em itálico
  ou em outra cor dentro de um título.

## Layout

- Celular primeiro. Coluna única até 640px; margem lateral mínima de 16px.
- Conteúdo com largura máxima de 1100px nas telas de trabalho e 1200px na
  apresentação.
- Espaçamento em múltiplos de 4px: 4, 8, 12, 16, 24, 32, 48, 64.
- Alvos de toque com pelo menos 44px.
- Telas de trabalho alinhadas à esquerda. Só o topo da apresentação é centralizado.

## Elevation & Depth

- A profundidade vem de superfície, não de sombra: cartão branco sobre névoa, painel
  céu sobre branco.
- Sombra só no que flutua de verdade: diálogo, menu, cartão solto na composição da
  apresentação. Uma sombra só, tingida de tinta:
  `0 18px 40px -18px rgb(14 19 32 / 0.28)`.
- Bordas de 1px na cor linha para separar cartões do fundo.

## Shapes

- Raio por papel, não um raio único: **10px** em controles (botão, campo), **16px**
  em cartões, **28px** em painéis grandes e molduras da apresentação, **pílula** em
  selos, abas e botões de filtro.
- **Ícones de interface:** conjunto próprio, traço de 1,75px, pontas e cantos
  arredondados, grade de 24px. Nada de biblioteca pronta.
- **Objetos ilustrados:** peças próprias em SVG, com volume (gradiente e sombra
  suave), do mundo da escola e da convocação: sino, lousa, prancheta de chamada,
  megafone, relógio, calendário, mochila, celular com a mensagem. Flutuam na
  apresentação e ilustram estados vazios. Não são emoji e não são cópias dos objetos
  das referências.

## Components

- **Botão:** primário azul, secundário neutro, perigo vermelho, texto. Altura 44px.
- **Campo, seleção e área de texto:** rótulo acima, borda linha, foco com anel azul.
- **Cartão** e **painel de destaque** (céu, raio 28px).
- **Selo de estado:** pílula com texto, uma variante por estado da convocação e da
  solicitação.
- **Onda:** a peça de assinatura. Mostra o número da onda, o prazo com anel de
  contagem em laranja e a fila de professores chamados com posição, nome e selo.
  Quando alguém aceita, a linha dele ganha destaque verde e as outras recuam.
- **Indicador:** número grande em Funnel Display com rótulo e, quando fizer sentido,
  um minigráfico.
- **Gráficos** em SVG próprio, ligados aos tokens: linha com área (gradiente no
  traço, marcador e etiqueta de valor), barras, rosca e minigráfico. Cada gráfico tem
  título, descrição acessível e valores legíveis sem depender de passar o mouse.
- **Diálogo**, **tabela** e **lista de registros**.

## Motion

- Nas telas de trabalho, o movimento só responde a uma ação ou a uma mudança real:
  onda nova entrando, aceite, prazo correndo. Durações de 150 a 250ms.
- Animação ligada à rolagem só na apresentação: a moldura do produto fica fixa e a
  convocação avança conforme a rolagem (onda 1, recusas, onda 2, aceite, comprovação).
- GSAP com `useGSAP`; ScrollTrigger só na apresentação.
- Com "reduzir movimento" ligado no aparelho, nada se anima sozinho e a história da
  apresentação aparece inteira, parada.
- Só se animam `transform` e `opacity`.

## Do's and Don'ts

- **Faça:** deixe a onda ser o elemento memorável; mantenha o resto calmo.
- **Faça:** mostre estado com texto e cor juntos.
- **Faça:** teste cada componente em claro e escuro, em 390px e 1280px.
- **Não faça:** animação de rolagem ou objetos flutuando nas telas do diretor.
- **Não faça:** ícones de biblioteca, emoji como ícone, texto em gradiente, cartão
  dentro de cartão, o mesmo raio e a mesma sombra em tudo.
- **Não faça:** copiar as peças das referências (as fotos presas com alfinete da
  Visor, os personagens da Grok Bot). Elas indicam o tom, não o desenho.
- **Não faça:** inventar números de uso, depoimentos ou marcas de clientes.
