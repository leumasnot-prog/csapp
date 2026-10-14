# 1. Modelo de dados

PostgreSQL 14+. Instantes em `timestamptz` (UTC). Datas e horários de aula em `date`/`time`,
interpretados em America/Sao_Paulo. Código: [`backend/app/models.py`](../backend/app/models.py).

```mermaid
erDiagram
    ESCOLA ||--o{ USUARIO_ESCOLA : ""
    USUARIO ||--o{ USUARIO_ESCOLA : "diretor de"
    USUARIO ||--o{ TOKEN_SENHA : "recuperação"
    ESCOLA ||--o{ SOLICITACAO : ""
    USUARIO ||--o{ SOLICITACAO : "criou"
    LISTA_CLASSIFICACAO ||--o{ CLASSIFICACAO : ""
    PROFESSOR ||--o{ CLASSIFICACAO : "posição"
    PROFESSOR ||--o{ HABILITACAO : ""
    DISCIPLINA ||--o{ HABILITACAO : ""
    PROFESSOR ||--o{ INDISPONIBILIDADE : ""
    LISTA_CLASSIFICACAO ||--o{ SOLICITACAO : "usada por"
    DISCIPLINA ||--o{ SOLICITACAO : ""
    SOLICITACAO ||--o{ ONDA : ""
    ONDA ||--o{ CONVOCACAO : ""
    ONDA ||--o{ ONDA_PULO : "pulados + motivo"
    PROFESSOR ||--o{ CONVOCACAO : ""
    CONVOCACAO ||--o{ RESPOSTA : "cada clique"
    CONVOCACAO ||--o{ OUTBOX_MENSAGEM : ""

    ESCOLA {
        int id PK
        string nome UK
        string codigo_inep UK
        string endereco
        string telefone
        bool ativa
    }
    USUARIO {
        int id PK
        string nome
        string email UK
        string cpf UK
        string senha_hash
        enum perfil "admin|diretor"
        bool ativo
        int versao_token
    }
    PROFESSOR {
        int id PK
        string nome
        string cpf UK
        string email
        string telefone
        bool ativo
        date suspenso_ate
        bigint telegram_chat_id UK
        string codigo_vinculo_hash
        ts consentimento_em
        ts consentimento_revogado_em
        ts bot_bloqueado_em
    }
    HABILITACAO {
        int id PK
        int professor_id FK
        enum etapa "EI|EF1|EF2|EJA|EE"
        int disciplina_id FK
    }
    LISTA_CLASSIFICACAO {
        int id PK
        string nome
        string edital
        bool ativa "no máx. 1 ativa"
        string arquivo_sha256
    }
    CLASSIFICACAO {
        int id PK
        int lista_id FK
        int professor_id FK
        int posicao "oficial, imutável"
        ts rebaixado_em "política FIM_DA_LISTA"
    }
    SOLICITACAO {
        int id PK
        int escola_id FK
        int lista_id FK
        enum etapa
        int disciplina_id FK
        string turma
        enum turno
        date data_inicio
        date data_fim
        time hora_inicio
        time hora_fim
        bool urgente
        int timeout_minutos
        enum status
        int ciclo
        int professor_aceito_id FK
    }
    ONDA {
        int id PK
        int solicitacao_id FK
        int ciclo
        int numero
        ts iniciada_em
        ts expira_em
        ts encerrada_em
        enum motivo_encerramento
    }
    ONDA_PULO {
        int id PK
        int onda_id FK
        int professor_id FK
        int posicao
        int ordem
        enum motivo
    }
    CONVOCACAO {
        int id PK
        int solicitacao_id FK
        int onda_id FK
        int ciclo
        int professor_id FK
        int posicao
        int ordem
        enum status
        ts enviada_em
        ts respondida_em
        int tempo_resposta_s
        string penalidade_aplicada
    }
    RESPOSTA {
        int id PK
        int convocacao_id FK
        enum tipo "ACEITE|RECUSA"
        ts recebida_em
        enum resultado
    }
    LOG_AUDITORIA {
        bigint id PK
        ts ocorrido_em
        string ator_tipo
        int ator_id
        string acao
        string entidade
        int entidade_id
        int escola_id
        jsonb dados
        string hash_anterior
        string hash UK
    }
```

Tabelas de apoio: `disciplina`, `indisponibilidade`, `configuracao` (linha única com as regras),
`outbox_mensagem` (fila de envio), `bot_sessao` (estado da conversa de vínculo), `token_senha`
e `log_acesso` (LGPD).

## Decisões importantes

| Ponto | Decisão |
|---|---|
| Posição oficial | `classificacao.posicao` nunca muda. "Fim da lista" grava `rebaixado_em`, e a fila é ordenada por `(rebaixado_em NULLS FIRST, rebaixado_em, posicao)`. |
| Ordem efetiva | `convocacao.ordem` e `onda_pulo.ordem` guardam a posição na fila **no momento da onda**. Com isso dá para reconstruir a decisão depois. |
| Um aceite por vaga | Índice único parcial `uq_convocacao_um_aceite (solicitacao_id, ciclo) WHERE status='ACEITA'`, além do lock de linha. |
| Ciclos | Reabrir incrementa `solicitacao.ciclo`. Convocações são únicas por `(solicitacao, ciclo, professor)`. |
| Uma lista ativa | Índice único parcial `uq_lista_ativa WHERE ativa`. |
| Exclusão | Escolas e usuários usam exclusão lógica (`ativa`/`ativo`), porque o histórico precisa continuar consultável. |
| Auditoria | Trigger `BEFORE UPDATE OR DELETE` e `BEFORE TRUNCATE` levanta exceção. `hash = sha256(hash_anterior + registro canônico)`. |
| LGPD | `codigo_vinculo_hash` (nunca o código em claro); CPF mascarado nas respostas da API (`***.456.789-**`); diretor só vê o contato de quem aceitou. |

## Estados

```mermaid
stateDiagram-v2
    [*] --> EM_CONVOCACAO: diretor cria
    EM_CONVOCACAO --> PREENCHIDA: 1º aceite válido
    EM_CONVOCACAO --> ESGOTADA: fila sem elegíveis
    EM_CONVOCACAO --> EXPIRADA: período terminou
    EM_CONVOCACAO --> CANCELADA: diretor cancela
    PREENCHIDA --> CANCELADA: diretor cancela (professor avisado)
    ESGOTADA --> CANCELADA
    CANCELADA --> EM_CONVOCACAO: reabrir (novo ciclo)
    ESGOTADA --> EM_CONVOCACAO: reabrir (novo ciclo)
    EXPIRADA --> EM_CONVOCACAO: reabrir, se o período não acabou
```

Convocação: `ENVIADA → ACEITA | RECUSADA | SEM_RESPOSTA (timeout) | VAGA_PREENCHIDA | CANCELADA | FALHA_ENVIO | INELEGIVEL`.
De `SEM_RESPOSTA` ainda é possível ir para `ACEITA` ou `RECUSADA` (resposta tardia), enquanto a vaga estiver aberta.
