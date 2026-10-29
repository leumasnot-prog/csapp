# Sistema de Substituição de Professores — Rede Municipal

Automatiza a convocação de professores substitutos **respeitando a ordem de classificação**.
O diretor abre a vaga pelo painel (no celular), o sistema convoca os professores pelo Telegram
em **ondas de 3**, o **primeiro que aceitar fica com a vaga** (com garantia transacional) e tudo
fica registrado num **log de auditoria imutável**.

| Documento | Conteúdo |
|---|---|
| [00 — Premissas e perguntas em aberto](docs/00-premissas-e-perguntas.md) | **Leia primeiro.** O que foi assumido e o que a Secretaria precisa decidir |
| [01 — Modelo de dados](docs/01-modelo-de-dados.md) | Diagrama ER, estados, decisões |
| [02 — Fluxo de convocação](docs/02-fluxo-convocacao.md) | Fluxograma, concorrência, casos de borda |
| [03 — Wireframes](docs/03-wireframes.md) | Wireframes + capturas do MVP rodando |
| [04 — API](docs/04-api.md) | Endpoints |
| [05 — Plano de testes](docs/05-plano-de-testes.md) | Com ênfase em concorrência |

## Arquitetura

```
 Diretor (celular) ──HTTPS──► FastAPI ──► PostgreSQL ◄── Worker (outbox + timeouts)
 Secretaria (web)            │  SPA React          ▲            │
                             │                     │            ├──► Telegram Bot API
 Professor ◄── Telegram ─────┴─ webhook ───────────┘            └──► SMTP (diretor/Secretaria)
```

- **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2, PostgreSQL.
- **Fila/jobs:** o próprio PostgreSQL (*transactional outbox* + `FOR UPDATE SKIP LOCKED`), com
  retry e backoff. Dispensa o Redis no MVP; o motivo está na premissa P23.
- **Frontend:** React + Vite + TypeScript, *mobile first*, servido pela própria API.
- **Bot:** Telegram (vínculo por CPF + código de 6 dígitos, consentimento LGPD com botões).

```
backend/app/
  models.py              entidades
  services/motor.py      motor de ondas (locks, aceite atômico, timeout, penalidades)
  services/elegibilidade.py  fila + regras de disponibilidade
  services/importacao.py CSV/XLSX com validação e dry-run
  services/relatorios.py comprovação da ordem, indicadores, CSV
  bot/handlers.py        comandos e botões do Telegram
  worker.py              envio do outbox + timeouts + expiração
  audit.py               log com hash encadeado
  api/                   rotas (auth, solicitacoes, admin, bot)
frontend/src/            painel do diretor e da Secretaria
```

## Só para ver: demonstração sem instalar nada

Abra o arquivo **`demo/substituicao-demo.html`** com dois cliques. Ele roda inteiro no
navegador, com dados fictícios, sem servidor e sem banco. Na tela de login há botões para
entrar como diretora ou como Secretaria. Na tela de cada solicitação, o quadro
**"Celular dos professores"** permite responder no lugar deles (Aceito/Recuso) e encerrar o
prazo de uma onda. As regras são as mesmas da API real, e os dados ficam só naquele navegador.

Para gerar o arquivo de novo: `cd frontend && npm run build:demo`.

## Rodando no Windows (mais simples)

1. Instale, aceitando as opções padrão:
   - [Python 3.12+](https://www.python.org/downloads/), marcando **"Add python.exe to PATH"**;
   - [Node.js LTS](https://nodejs.org/);
   - [PostgreSQL](https://www.postgresql.org/download/windows/). **Anote a senha** que ele pedir para o usuário `postgres`.
2. Na pasta do projeto, dê dois cliques em **`instalar-windows.bat`**. Ele pede a senha do
   `postgres`, cria o banco, compila o painel e cria os dados de demonstração.
3. Dê dois cliques em **`iniciar-windows.bat`**. O navegador abre em http://localhost:8000.
4. Para simular a resposta de um professor sem o Telegram, use, num `cmd` na pasta do projeto:
   `simular-resposta.bat 1 3 aceito` (solicitação nº 1, 3º colocado aceita).

## Rodando localmente (Linux/macOS)

Pré-requisitos: Python 3.12+, Node 20+ e PostgreSQL 14+.

```bash
# banco
createuser -s subst && psql -c "ALTER USER subst PASSWORD 'subst'"
createdb -O subst subst_dev && createdb -O subst subst_test

# backend
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
python -m app.cli demo --simular-vinculo  # cria esquema, escolas, usuários e lista de 40 professores
uvicorn app.main:app --reload             # http://localhost:8000  (API em /docs)
python -m app.worker                      # em outro terminal

# frontend (desenvolvimento, com proxy para a API)
cd ../frontend && npm install && npm run dev   # http://localhost:5173
# ou: npm run build  → a API passa a servir o painel em http://localhost:8000
```

Usuários da demo: `admin@exemplo.gov.br / admin12345`, `diretor@exemplo.gov.br / diretor12345`.

Sem token do Telegram configurado (`SUBST_MENSAGEIRO=fake`, o padrão), as mensagens aparecem no
log do worker. Para simular o clique de um professor, chame o webhook:

```bash
curl -X POST localhost:8000/api/bot/telegram/webhook \
  -H 'X-Telegram-Bot-Api-Secret-Token: <SUBST_TELEGRAM_WEBHOOK_SECRET>' -H 'Content-Type: application/json' \
  -d '{"update_id":1,"callback_query":{"id":"x","from":{"id":900001},"data":"c:<convocacao_id>:a"}}'
```

Com um bot real (crie um no @BotFather): defina `SUBST_MENSAGEIRO=telegram` e
`SUBST_TELEGRAM_BOT_TOKEN`, e rode `python -m app.cli bot-polling` em desenvolvimento ou
`python -m app.cli webhook https://seu-dominio/api/bot/telegram/webhook` em produção.

### Testes

```bash
cd backend && pytest     # 127 testes contra PostgreSQL real (inclui 68 execuções de concorrência)
```

## Produção (VPS)

```bash
cp .env.example .env     # preencha os segredos
docker compose up -d --build
docker compose exec api python -m app.cli criar-admin --nome "Secretaria" --email voce@prefeitura.gov.br
docker compose exec api python -m app.cli webhook https://seu-dominio/api/bot/telegram/webhook
```

Ponha um proxy reverso com HTTPS (Caddy ou nginx) na frente da porta 8000; o webhook do
Telegram exige HTTPS. Faça backup diário do volume do Postgres (`pg_dump`).

## Implantação: ordem sugerida

1. Responder às perguntas em aberto ([doc 00](docs/00-premissas-e-perguntas.md)) e ajustar as **Regras** no painel.
2. Cadastrar escolas e diretores.
3. Importar a lista de classificação (validar → conferir prévia → confirmar).
4. Gerar os códigos de vínculo e distribuí-los aos professores, que fazem o vínculo e dão o consentimento no bot.
5. Piloto com 1 ou 2 escolas, depois expansão.

## Limitações conhecidas do MVP

- Migrações de banco via `create_all` (sem Alembic ainda); adicionar Alembic antes da 1ª alteração de esquema em produção.
- O limitador de tentativas de login fica em memória, por processo.
- O painel do diretor é atualizado por *polling* (5 s), não por push.
- Não há canal WhatsApp: a interface `Mensageiro` está pronta, mas o adaptador da WhatsApp Cloud API não foi implementado.
- Não há expurgo automático de dados (política de retenção pendente, Q13).
