# 2. Fluxo de convocação por ondas

Código: [`backend/app/services/motor.py`](../backend/app/services/motor.py) e
[`elegibilidade.py`](../backend/app/services/elegibilidade.py).

## 2.1 Fluxo principal

```mermaid
flowchart TD
    A[Diretor cria solicitação] --> B[Monta a fila: lista ativa ∩ habilitação etapa+disciplina<br/>ordem: rebaixado_em NULLS FIRST, posição]
    B --> C{Próximos elegíveis<br/>não convocados neste ciclo}
    C -- "pula com motivo:<br/>sem bot, sem consentimento, suspenso,<br/>indisponível, conflito de horário, limites" --> C
    C -- nenhum --> X[ESGOTADA<br/>e-mail ao diretor e à Secretaria]
    C -- "até 3" --> D[Cria onda N + convocações + outbox<br/>expira_em = agora + timeout]
    D --> W[Worker envia pelo Telegram<br/>com botões Aceito/Recuso]
    W --> E{Evento}
    E -- "Aceito (1º a chegar ao lock)" --> F[PREENCHIDA<br/>outros: 'vaga já preenchida'<br/>diretor: nome + contato]
    E -- Recuso --> G{Ainda há alguém<br/>da onda aguardando?}
    G -- sim --> E
    G -- não --> C
    E -- "timeout (worker)" --> H[aguardando → SEM_RESPOSTA<br/>onda encerrada: TIMEOUT] --> C
    E -- diretor cancela --> I[CANCELADA<br/>convocados avisados]
    E -- "período terminou" --> J[EXPIRADA]
```

## 2.2 Concorrência: por que dois professores nunca ficam com a mesma vaga

Toda transição de estado de uma vaga começa com `SELECT … FROM solicitacao WHERE id=? FOR UPDATE`.
Isso vale para aceite, recusa, timeout, cancelamento, reabertura e falha de envio. A linha da
solicitação funciona como um mutex por vaga.

```mermaid
sequenceDiagram
    participant P1 as Professor 1
    participant P2 as Professor 2
    participant API as Webhook (2 threads)
    participant DB as PostgreSQL
    P1->>API: Aceito (convocação 11)
    P2->>API: Aceito (convocação 12)
    API->>DB: T1: SELECT solicitacao FOR UPDATE
    API->>DB: T2: SELECT solicitacao FOR UPDATE (bloqueia)
    DB-->>API: T1 obtém o lock
    API->>DB: T1: status EM_CONVOCACAO → ACEITA, PREENCHIDA, outbox
    API->>DB: T1: COMMIT (libera)
    DB-->>API: T2 obtém o lock e relê: PREENCHIDA
    API->>DB: T2: registra resposta "VAGA_JA_PREENCHIDA"
    API-->>P1: ✅ Vaga confirmada
    API-->>P2: ℹ️ Vaga já preenchida
```

Ordem fixa de locks, para evitar deadlock:

1. linha da **solicitação**;
2. linhas de **professor** envolvidas (quem responde e quem pode ser penalizado), todas de uma vez, em ordem crescente de `id`;
3. **advisory lock da auditoria**, sempre no `before_commit`.

Defesa em profundidade: o índice único parcial `uq_convocacao_um_aceite` faz o banco recusar
um segundo `ACEITA` mesmo se algum caminho de código esquecer o lock. Isso é testado.

## 2.3 Casos de borda

| Caso | Comportamento | Teste |
|---|---|---|
| Aceites simultâneos (3 ou 10 threads) | Exatamente 1 `VAGA_CONCEDIDA`; os demais recebem `VAGA_JA_PREENCHIDA` | `test_tres_aceites_simultaneos…`, `test_dez_aceites…` |
| Mesmo professor aceita duas vagas com conflito de horário ao mesmo tempo | O professor é travado no aceite: uma vaga é concedida e a outra vira `CONFLITO` (`INELEGIVEL`) | `test_mesmo_professor_aceita_duas_vagas…` |
| Aceite chega junto com o timeout | Serializados pelo lock. Como o aceite tardio é permitido, a vaga fica com quem aceitou em qualquer ordem | `test_aceite_versus_timeout` |
| Aceite chega junto com o cancelamento | Se o aceite vem primeiro, o professor fica `ACEITA` e recebe o aviso de cancelamento. Se o cancelamento vem primeiro, o aceite recebe "encerrada" | `test_aceite_versus_cancelamento` |
| Todos da onda recusam | Próxima onda imediata, sem esperar o timeout | `test_todos_recusam…`, `test_recusas_simultaneas…` |
| Ninguém responde | O worker fecha a onda (`TIMEOUT`) e dispara a próxima | `test_timeout_dispara_proxima_onda` |
| Aceite tardio (onda já expirada, vaga aberta) | Vale por padrão; é configurável (`PRAZO_ENCERRADO`) | `test_aceite_tardio_*` |
| Fila esgotada | `ESGOTADA`, alerta por e-mail ao diretor e aos admins | `test_fila_esgotada…` |
| Cancelamento no meio do processo | Convocações em aberto viram `CANCELADA` e os professores são avisados; cliques posteriores recebem "encerrada" | `test_cancelamento_no_meio…` |
| Vaga preenchida antes de a mensagem sair | O worker descarta a convocação obsoleta e o aviso de encerramento | `test_mensagem_de_convocacao_obsoleta…` |
| Professor bloqueou o bot (HTTP 403) | `FALHA_ENVIO` + `bot_bloqueado_em`. Se a onda inteira falhar, avança na hora | `test_falha_de_envio_permanente…` |
| Falha temporária (5xx, 429, rede) | Retry com backoff exponencial (5 s, 10 s, 20 s… até 15 min), máximo de 6 tentativas | `test_falha_temporaria…` |
| Período da aula terminou sem aceite | `EXPIRADA` + e-mail ao diretor | `test_expira_quando…` |
| Reabrir | Novo ciclo do topo; botões do ciclo anterior deixam de valer | `test_reabrir…` |
| Clique repetido ou update reenviado pelo Telegram | Idempotente (`JA_RESPONDIDA`), e todo clique fica em `resposta` | `test_resposta_repetida…` |
| Vários workers | Outbox com `FOR UPDATE SKIP LOCKED`; timers com `SKIP LOCKED` na solicitação | `test_workers_concorrentes…` |
| Deadlock detectado pelo Postgres (raro) | O webhook devolve 500 e o Telegram reenvia; o worker repete no ciclo seguinte | — |

## 2.4 Penalidades (configuráveis)

| Evento | Quando aplica | Opções |
|---|---|---|
| Recusa | Na hora | `MANTER` (padrão), `FIM_DA_LISTA`, `SUSPENDER n dias` |
| Sem resposta | No **encerramento** da vaga (preenchida, esgotada ou expirada), **nunca** no cancelamento. Quem recebeu "vaga preenchida" antes do prazo não é penalizado | idem |

## 2.5 Garantia de entrega

```
transação do motor ──► grava estado + linha no outbox (mesmo COMMIT)
worker ──► SELECT outbox PENDENTE FOR UPDATE SKIP LOCKED ──► Telegram/SMTP
         ├─ ok          → ENVIADA (+ message_id na convocação)
         ├─ temporária  → PENDENTE, proxima_tentativa_em = agora + backoff
         └─ permanente  → FALHA → motor.falha_envio() (pode avançar a onda)
```

A entrega é *at-least-once*: se o worker cair depois de enviar e antes do commit, a mensagem
pode sair duas vezes. Isso é inofensivo porque os botões são idempotentes.
