# 4. Endpoints da API

Base `/api`, JSON e autenticação `Authorization: Bearer <JWT>`. A especificação OpenAPI
interativa fica em `/docs`, com a API no ar.

Isolamento: as rotas de diretor filtram pelas escolas vinculadas. Acessar uma solicitação de
outra escola devolve **404** (e não 403), para não revelar que ela existe.

## Autenticação
| Método | Rota | Quem | Descrição |
|---|---|---|---|
| POST | `/auth/login` | público | `{login: email ou CPF, senha}` → token. Limite de 8 tentativas a cada 15 min por login+IP |
| GET | `/auth/me` | logado | Usuário atual e suas escolas |
| POST | `/auth/esqueci-senha` | público | Envia link por e-mail. Sempre responde 202 |
| POST | `/auth/redefinir-senha` | público | `{token, nova_senha}`. Token de uso único, válido por 60 min |
| POST | `/auth/alterar-senha` | logado | Invalida os tokens anteriores (`versao_token`) |

## Diretor (e admin)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/escolas` | Escolas que o usuário pode ver |
| GET | `/catalogo` | Disciplinas, etapas e turnos |
| GET | `/solicitacoes?status&escola_id&inicio&fim` | Lista com escopo por escola |
| POST | `/solicitacoes` | Cria e dispara a 1ª onda |
| GET | `/solicitacoes/{id}` | Detalhe: ondas, convocações, pulados e contato de quem aceitou |
| POST | `/solicitacoes/{id}/cancelar` | `{motivo?}` |
| POST | `/solicitacoes/{id}/reabrir` | Abre um novo ciclo do topo da fila |
| GET | `/solicitacoes/{id}/comprovacao?formato=json\|csv` | Comprovação da ordem de classificação |

## Admin (`/admin`, perfil admin)
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/admin/escolas` | Listar e criar |
| PUT/DELETE | `/admin/escolas/{id}` | Editar e desativar (exclusão lógica) |
| GET/POST | `/admin/usuarios` | Criar diretor/admin (sem senha informada, gera uma provisória) |
| PUT | `/admin/usuarios/{id}` | Editar escolas, perfil, ativo e senha; derruba as sessões abertas |
| GET/POST | `/admin/disciplinas` | Catálogo |
| GET/POST | `/admin/professores?busca=` | CPF mascarado na resposta |
| PUT | `/admin/professores/{id}` | Dados, habilitações e suspensão manual |
| POST | `/admin/professores/{id}/codigo-vinculo` | Código de 6 dígitos para o bot (uso único, válido 7 dias) |
| GET | `/admin/listas` | Listas importadas |
| POST | `/admin/listas/importar` | multipart: `arquivo, nome, edital?, ativar, confirmar`. Com `confirmar=false` faz só o *dry-run* |
| POST | `/admin/listas/{id}/ativar` | Troca a lista ativa |
| GET | `/admin/listas/{id}/classificacao` | Ordem efetiva × posição oficial |
| GET/PUT | `/admin/configuracao` | Regras do motor |
| GET | `/admin/painel?escola_id&status&inicio&fim` | Indicadores + solicitações |
| GET | `/admin/relatorios/solicitacoes.csv?…` | Exportação (o próprio download fica registrado na auditoria) |
| GET | `/admin/auditoria?entidade&entidade_id&escola_id&acao&antes_de_id&limite` | Log |
| GET | `/admin/auditoria/verificar` | Recalcula a cadeia de hashes |

## Bot e infraestrutura
| Método | Rota | Descrição |
|---|---|---|
| POST | `/bot/telegram/webhook` | Exige o header `X-Telegram-Bot-Api-Secret-Token` |
| GET | `/health` | Liveness |

## Callbacks do bot
| `callback_data` | Ação |
|---|---|
| `c:{convocacao_id}:a` / `c:{id}:r` | Aceitar / recusar |
| `lgpd:s` / `lgpd:n` | Concordar / não concordar com o termo |
| `ind:x:{id}` | Remover indisponibilidade |
| `sair:s` / `sair:n` | Confirmar desvínculo |
