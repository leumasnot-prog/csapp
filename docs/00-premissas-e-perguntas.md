# 0. Premissas assumidas e perguntas em aberto

Este documento foi escrito **antes do código**. Toda premissa que depende de edital,
lei municipal ou decisão da Secretaria virou **parâmetro configurável**
(tabela `configuracao`, editável pelo admin). Assim, responder a uma pergunta em
aberto significa, na maioria dos casos, mudar uma configuração, e não reescrever código.

## 0.1 Premissas

### Escopo e atores
| # | Premissa |
|---|----------|
| P1 | Um único município (um único "tenant"). Multi-município fica fora do MVP. |
| P2 | Perfis do painel: `admin` (Secretaria) e `diretor`. Um diretor pode estar vinculado a **uma ou mais escolas** e só enxerga dados delas. Vice-diretor ou coordenador entram como `diretor`. |
| P3 | O professor substituto **não tem acesso ao painel**. Ele interage somente pelo bot. |
| P4 | O canal do MVP é o **Telegram**: gratuito, com botões inline e sem template pré-aprovado. O envio passa por uma interface `Mensageiro`, então dá para trocar por WhatsApp Cloud API depois (ver Q12). |

### Classificação e habilitação
| # | Premissa |
|---|----------|
| P5 | A classificação vem de uma **lista** (processo seletivo/edital) importada por CSV/XLSX. Pode haver várias listas cadastradas, mas só **uma fica ativa** por vez. Cada solicitação guarda a lista usada no momento em que foi criada. |
| P6 | A posição oficial (`classificacao.posicao`) é **imutável**. Penalidades do tipo "ir para o fim da lista" não reescrevem a posição: o sistema grava a data do rebaixamento (`rebaixado_em`) e ordena por `(rebaixado_em NULLS FIRST, rebaixado_em, posicao)`. Assim, o relatório consegue explicar cada desvio da ordem original. |
| P7 | Habilitação é um par **(etapa, disciplina)**. Etapas fixas: `EI` (Ed. Infantil), `EF1` (Anos iniciais), `EF2` (Anos finais), `EJA` e `EE` (Ed. Especial). As disciplinas ficam num catálogo (ex.: "Polivalente", "Matemática", "Educação Física"). O professor só é convocado para uma vaga cuja (etapa, disciplina) esteja entre as habilitações dele. |
| P8 | Para cada solicitação a fila **recomeça do topo** da classificação: os 3 primeiros elegíveis sempre recebem a primeira onda. |

### Solicitação e motor
| # | Premissa |
|---|----------|
| P9 | Cada solicitação cobre um **intervalo de datas** (`data_inicio` a `data_fim`) e um **horário diário** (`hora_inicio` a `hora_fim`). São considerados dias letivos de segunda a sexta. Se o intervalo tiver só sábado ou domingo (ex.: sábado letivo), esses dias contam. Datas salteadas viram solicitações separadas. |
| P10 | Ondas de **3** professores, timeout padrão de **15 min**. O diretor pode marcar a solicitação como urgente, o que usa um timeout menor (padrão 5 min). Os dois valores são configuráveis. |
| P11 | **Primeiro aceite válido leva a vaga.** Quem serializa tudo é a linha da solicitação, com `SELECT … FOR UPDATE`. Toda transição de estado de uma vaga (aceite, recusa, timeout, cancelamento) trava essa linha primeiro. Há também um índice único parcial (uma única convocação `ACEITA` por solicitação e ciclo) como segunda barreira. |
| P12 | O professor também é travado (`FOR UPDATE`) no aceite. Isso impede que ele aceite, ao mesmo tempo, duas vagas de escolas diferentes com conflito de horário. |
| P13 | **Aceite tardio** é aceito por padrão (`aceitar_resposta_tardia = true`). Se a onda 1 expirou, a onda 2 já saiu e o 1º colocado clica em "Aceito" enquanto a vaga ainda está aberta, ele leva a vaga. Isso respeita mais a classificação e preenche a vaga mais rápido. |
| P14 | Se todos os professores de uma onda recusarem (ou falharem no envio), a próxima onda sai **na hora**, sem esperar o timeout. |
| P15 | Penalidades padrão: **recusa mantém a posição**, **ausência de resposta mantém a posição**. As duas são configuráveis entre `MANTER`, `FIM_DA_LISTA` e `SUSPENDER` (por N dias). A penalidade por recusa vale na hora. A penalidade por ausência de resposta só vale **quando a solicitação é encerrada** (preenchida, esgotada ou expirada, mas não cancelada), para não punir quem ainda poderia aceitar tarde. Quem recebeu "vaga já preenchida" antes do timeout **não** é penalizado. |
| P16 | Quem já tem substituição aceita com **conflito de horário** (mesmo dia letivo e horários sobrepostos) fica indisponível. Com `exclusividade_no_periodo = true`, qualquer substituição ativa no período bloqueia, mesmo sem sobreposição de horário. |
| P17 | Limites opcionais, desligados por padrão: número máximo de substituições simultâneas e carga horária semanal máxima (somada por semana ISO). |
| P18 | **Elegibilidade** de quem está na fila: ativo; vinculado ao bot; com consentimento LGPD; sem ter bloqueado o bot; não suspenso; sem indisponibilidade declarada no período; sem conflito de horário; dentro dos limites; ainda não convocado neste ciclo da solicitação. Quem não é elegível é **pulado com motivo registrado** (`onda_pulo`). É isso que permite comprovar a ordem. |
| P19 | **Reabrir** só vale para solicitações `CANCELADA`, `ESGOTADA` ou `EXPIRADA` com período ainda futuro. A reabertura abre um **novo ciclo**: a fila recomeça do topo e quem recusou antes pode ser convocado de novo. Se o professor aceito desistir, o diretor cancela (o professor é avisado) e reabre. |
| P20 | Se o período da solicitação terminar sem aceite, ela é encerrada como `EXPIRADA`. |
| P21 | Fila esgotada significa que não sobrou nenhum elegível: o status vira `ESGOTADA` e o sistema alerta os diretores da escola e todos os admins. |

### Infraestrutura
| # | Premissa |
|---|----------|
| P22 | **Ajuste de stack:** Python 3.12+ / FastAPI / SQLAlchemy 2 / PostgreSQL 14+; frontend React + Vite (SPA servida pela própria API); deploy com Docker Compose numa VPS. |
| P23 | **Ajuste de fila:** os jobs de disparo e de timeout usam o **próprio PostgreSQL** (padrão *transactional outbox* + `FOR UPDATE SKIP LOCKED`), não o Redis. Assim, a mensagem só existe se a transação que a gerou foi confirmada, e um timeout nunca se perde num restart do Redis. O worker tem retry com backoff exponencial. Isso dispensa o Redis no MVP. Ele pode voltar depois para rate limiting distribuído ou pub/sub em tempo real (ver Q15). |
| P24 | O "tempo real" no painel do diretor é feito por *polling* a cada 5 s, suficiente para o volume de um município. |
| P25 | Timestamps ficam em UTC (`timestamptz`). Datas e horários de negócio usam **America/Sao_Paulo**. |
| P26 | O diretor é avisado do aceite pelo painel e por **e-mail** (SMTP). Não há bot para diretores no MVP (ver Q9). |

### LGPD e auditoria
| # | Premissa |
|---|----------|
| P27 | Base legal: execução de políticas públicas / obrigação legal (art. 7º, II e III, e art. 23 da LGPD). Mesmo assim, o requisito pede **consentimento explícito para contato pelo bot**, coletado com botões, datado e revogável pelo comando `/sair`. Sem consentimento, não há convocação. |
| P28 | Minimização: o diretor vê **nome** e status dos convocados da sua vaga, e **telefone só do professor que aceitou**. CPF nunca aparece para o diretor. O CPF é guardado completo porque é a chave do vínculo com o bot e da importação. |
| P29 | Log de auditoria **imutável**: um trigger no Postgres bloqueia `UPDATE` e `DELETE`, e há um **encadeamento de hashes** (SHA-256 do registro anterior). O admin pode verificar a integridade da cadeia. Há também um log de acesso separado (quem acessou qual rota, quando e de qual IP). |

## 0.2 Perguntas em aberto (para a Secretaria / Jurídico)

| # | Pergunta | Default adotado |
|---|----------|-----------------|
| Q1 | Existe **uma lista única** ou uma lista **por cargo/disciplina** (PEB I, PEB II-Matemática…)? | Uma lista ativa, com filtro por habilitação. O modelo já guarda `lista_id` por solicitação. |
| Q2 | O que o edital diz sobre **recusa**: mantém a posição, vai para o fim da lista ou suspende por X dias? Há limite de recusas (ex.: 3 recusas = desclassificação)? | `MANTER` |
| Q3 | E sobre **não responder**? | `MANTER` |
| Q4 | Qual timeout é aceitável? Muda conforme a antecedência (ex.: aula em menos de 2 h)? | 15 min normal e 5 min urgente |
| Q5 | Pode haver **disparo noturno**? Existe janela de silêncio (ex.: das 22h às 6h)? | Sem janela (a falta pode surgir de madrugada) |
| Q6 | O **aceite tardio** (depois do timeout, com a vaga ainda aberta) deve valer? | Sim |
| Q7 | Limite de substituições simultâneas por professor e carga horária semanal máxima? | Sem limite |
| Q8 | A indisponibilidade declarada pelo professor precisa de justificativa ou aprovação? | Não, é autodeclarada |
| Q9 | O diretor quer receber o aviso de aceite também por Telegram ou WhatsApp, além do e-mail? | Painel e e-mail |
| Q10 | Quem pode **reabrir** uma vaga preenchida quando o professor desiste, e isso gera penalidade para quem desistiu? | Cancelar e reabrir, sem penalidade automática |
| Q11 | O relatório de ordem de classificação precisa ser publicado (portal da transparência)? Em que formato? | CSV e JSON para o admin |
| Q12 | Telegram ou **WhatsApp**? O WhatsApp exige conta Business verificada, templates aprovados pela Meta e tem custo por conversa. | Telegram |
| Q13 | Por quanto tempo os dados são retidos (logs, professores fora da lista)? | Sem expurgo automático no MVP |
| Q14 | Como o professor recebe o **código de vínculo**: impresso na posse, por e-mail ou por SMS? | Gerado pelo admin no painel e entregue fora do sistema (pode ser por e-mail) |
| Q15 | Volume esperado (escolas, professores, faltas por dia)? Acima de algumas centenas de solicitações por dia, vale reavaliar o Redis para pub/sub e rate limiting. | Até cerca de 100 escolas e 2.000 professores |
