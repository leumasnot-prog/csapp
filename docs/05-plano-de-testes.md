# 5. Plano de testes

Os testes rodam contra um **PostgreSQL real**: o que está sendo testado inclui locks, `SKIP LOCKED`,
índices parciais e triggers, e nada disso existe num SQLite ou num mock.

```bash
cd backend
export SUBST_TEST_DATABASE_URL=postgresql+psycopg://subst:subst@localhost:5432/subst_test
pytest            # 127 testes, cerca de 1 min
```

O relógio de negócio é controlável (`tempo.set_agora`), o que permite testar timeouts sem
`sleep`. O Telegram e o e-mail são substituídos por implementações em memória.

## 5.1 Cobertura atual

| Arquivo | Qtde | Foco |
|---|---|---|
| `test_concorrencia.py` | 68 | Corridas (vários cenários repetidos 15×) |
| `test_motor.py` | 29 | Regras e casos de borda do motor |
| `test_api.py` | 11 | Login, perfis, **isolamento entre escolas**, CRUD, importação, reset de senha, log de acesso |
| `test_importacao.py` | 8 | CSV/XLSX, validação por linha, dry-run, reimportação |
| `test_bot.py` | 7 | Vínculo CPF+código, limite de tentativas, consentimento, botões, comandos |
| `test_auditoria.py` | 4 | Imutabilidade (trigger), detecção de adulteração, rollback |

## 5.2 Cenários de concorrência (prioridade máxima)

Técnica: N threads, cada uma com a **própria conexão e transação**, liberadas juntas por uma
`threading.Barrier`. Cada cenário é parametrizado para rodar várias vezes. Depois verificam-se
**invariantes**, e não uma ordem específica de chegada.

| # | Cenário | Invariante verificada |
|---|---|---|
| C1 | 3 professores clicam "Aceito" ao mesmo tempo (15×) | Exatamente 1 `ACEITA`; os outros 2 recebem `VAGA_JA_PREENCHIDA`; `professor_aceito_id` igual ao da convocação aceita |
| C2 | Onda de 10 com 10 aceites simultâneos (5×) | Exatamente 1 vencedor |
| C3 | Mesmo professor aceita 2 vagas com conflito de horário em escolas diferentes (15×) | Um `VAGA_CONCEDIDA` e um `CONFLITO`; o professor tem só 1 `ACEITA` |
| C4 | Aceite × cancelamento (15×) | Estado final `CANCELADA`; a convocação fica `ACEITA` (aceite primeiro) ou `CANCELADA` (cancelamento primeiro), nunca outra coisa; nenhuma exceção |
| C5 | Aceite × worker de timeout (15×) | Um único aceite; convocações só em estados válidos |
| C6 | 3 recusas simultâneas (5×) | Exatamente **uma** onda 2 disparada (nada de ondas duplicadas) |
| C7 | 3 workers processando o outbox em paralelo | Nenhuma mensagem enviada duas vezes |
| C8 | `UPDATE` direto de duas convocações para `ACEITA` | O índice único parcial rejeita a segunda (defesa em profundidade) |

**Prova de que os testes têm efeito (teste de mutação, executado):** com o `FOR UPDATE` removido
do motor, 51 das 68 execuções de concorrência **falham** (C1, C3, C4, C5 e C6). Com o lock, as 68 passam.

## 5.3 Regras do motor (`test_motor.py`)

- 1ª onda = 3 primeiros elegíveis, mensagem com dados da aula e botões.
- Aceite: vaga preenchida, demais avisados, e-mail ao diretor com nome e telefone.
- Todos recusam: próxima onda imediata. Timeout: próxima onda. Urgente: prazo de 5 min.
- Aceite tardio permitido ou bloqueado conforme a configuração.
- Fila esgotada: alerta ao diretor e à Secretaria.
- Filtro por habilitação; pulos com motivo (sem bot, sem consentimento, indisponível, suspenso).
- Conflito de horário, limite de substituições simultâneas e carga horária semanal.
- Conflito surgido depois da convocação: `INELEGIVEL`.
- Cancelamento no meio do processo; cancelamento de vaga preenchida libera a agenda.
- Reabrir: novo ciclo do topo; botões antigos invalidados; não reabre vaga preenchida.
- Penalidades: fim da lista (posição oficial intacta), suspensão por N dias, sem resposta só no
  encerramento e nunca no cancelamento.
- Expiração pelo fim do período.
- Falha permanente (bot bloqueado) avança a onda; falha temporária faz retry com backoff;
  mensagens obsoletas são descartadas.
- Idempotência de cliques; professor não responde convocação de outro.

## 5.4 Próximos testes recomendados (fora do MVP)

| Tipo | O quê |
|---|---|
| Carga | k6/Locust: 200 webhooks/s de aceite sobre 50 vagas simultâneas, medindo p95 e ausência de deadlock nos logs do Postgres |
| Caos | Matar o worker no meio do envio (verificar a entrega *at-least-once*); reiniciar o Postgres durante uma onda |
| E2E | Playwright no fluxo do diretor no celular (o roteiro em `docs/img` já foi gerado assim) |
| Bot real | Bot de homologação no Telegram com 3 contas de teste, para validar formatação e botões |
| Segurança | OWASP ZAP na API; teste de IDOR em todas as rotas com `{id}`; força bruta no vínculo |
| Aceitação | Roteiro com a Secretaria cobrindo as perguntas em aberto do doc 00 |
