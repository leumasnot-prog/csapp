# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Diretor de escola (ou quem responde pela unidade).** Usa no celular, de pé, com
  pressa: descobre que um professor faltou e precisa de um substituto em minutos.
  Abre a solicitação, acompanha quem foi chamado e quem aceitou, cancela ou reabre.
  Vê só a própria escola.
- **Secretaria de Educação + RH.** Usa no computador. Cadastra escolas e usuários,
  importa a lista de classificação, ajusta as regras, acompanha a rede inteira,
  exporta relatórios e consulta a auditoria.
- **Professor substituto.** Recebe a convocação com os dados da aula e responde
  Aceito ou Recuso. Hoje responde pelo bot de mensagens e não usa o painel.

## Product Purpose

Automatizar a convocação de professores substitutos da rede municipal de Pradópolis
(SP), respeitando a ordem de classificação do processo seletivo. Sucesso é a vaga
preenchida rápido, pelo professor certo na ordem certa, com registro que permita
responder a qualquer questionamento depois.

## Positioning

A ordem de classificação é respeitada e comprovável: cada professor chamado, pulado
(com o motivo) ou que não respondeu fica registrado, e o primeiro aceite válido leva
a vaga sem risco de duas pessoas ficarem com ela.

## Operating Context

- A convocação sai em ondas: os primeiros elegíveis da fila recebem ao mesmo tempo,
  com prazo para responder. Sem resposta ou com recusa de todos, sai a onda seguinte.
- A falta costuma ser descoberta perto do horário da aula, muitas vezes já com a
  aula iniciada.
- A classificação vem de planilha (CSV ou XLSX) do processo seletivo.
- Os relatórios de horas por professor e por unidade servem à conferência de
  pagamento.
- Há dois códigos em avaliação: este repositório e o sistema `substituicoes`, que
  segue o documento oficial da Prefeitura (MRN de 04/11/2026), com PEB I e PEB II,
  quatro níveis de urgência, limite mensal de horas e calendário letivo. Os dois
  usam React, TypeScript e Vite no painel e FastAPI com PostgreSQL no servidor.

## Capabilities and Constraints

- Vocabulário do produto: solicitação, onda (ou rodada), convocação, pulado,
  ciclo (reabertura), lista de classificação, habilitação, unidade.
- Estados de uma solicitação: em convocação, preenchida (atendida), fila esgotada,
  cancelada, expirada.
- Isolamento entre escolas: um diretor nunca vê dados de outra escola.
- LGPD: consentimento do professor para contato, dados pessoais minimizados (o
  diretor vê o telefone só de quem aceitou; CPF aparece mascarado).
- Idioma pt-BR. Datas e horários no fuso America/Sao_Paulo.
- Em aberto: canal de mensagens (Telegram ou WhatsApp pela API oficial); qual dos
  dois códigos será a base; regras de recusa e de falta de resposta, que dependem
  do edital.

## Evidence on Hand

- Dados de demonstração fictícios em `frontend/src/demo/servidor.ts` (3 escolas,
  40 professores) e a demonstração pronta em `demo/substituicao-demo.html`.
- Capturas das telas atuais em `docs/img/`.
- Não existem depoimentos, números de uso real nem marca visual definida. Nada disso
  deve ser inventado.

## Product Principles

1. A ordem de classificação vem antes da conveniência.
2. Quem abre a vaga está com pressa: menos campos, menos toques, resposta clara.
3. Todo estado tem dono e motivo visíveis: quem foi chamado, quem foi pulado e por quê.
4. O que o sistema registra precisa servir de prova.

## Accessibility & Inclusion

Uso em celular com uma mão, em corredor de escola e sob luz forte. Público com
familiaridade variada com tecnologia. Contraste legível, alvos de toque grandes,
foco visível pelo teclado e animações que respeitem a preferência por menos
movimento.
