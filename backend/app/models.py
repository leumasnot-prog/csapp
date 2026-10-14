"""Modelo de dados.

Entidades principais: Escola, Usuario (admin/diretor), Professor, Habilitacao,
ListaClassificacao/Classificacao, Solicitacao, Onda, Convocacao, Resposta,
LogAuditoria. Apoio: Disciplina, Indisponibilidade, OndaPulo, Configuracao,
OutboxMensagem, BotSessao, TokenSenha, LogAcesso.
"""
from __future__ import annotations

import enum
from datetime import date, datetime, time

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .tempo import agora

JSONType = JSON().with_variant(JSONB(), "postgresql")


def _enum(cls):
    return Enum(cls, native_enum=False, length=32, validate_strings=True)


class Perfil(str, enum.Enum):
    ADMIN = "admin"
    DIRETOR = "diretor"


class Etapa(str, enum.Enum):
    EI = "EI"  # Educação Infantil
    EF1 = "EF1"  # Ensino Fundamental - anos iniciais
    EF2 = "EF2"  # Ensino Fundamental - anos finais
    EJA = "EJA"
    EE = "EE"  # Educação Especial


ETAPA_NOMES = {
    Etapa.EI: "Educação Infantil",
    Etapa.EF1: "Fundamental - Anos Iniciais",
    Etapa.EF2: "Fundamental - Anos Finais",
    Etapa.EJA: "EJA",
    Etapa.EE: "Educação Especial",
}


class Turno(str, enum.Enum):
    MANHA = "MANHA"
    TARDE = "TARDE"
    NOITE = "NOITE"
    INTEGRAL = "INTEGRAL"


class StatusSolicitacao(str, enum.Enum):
    EM_CONVOCACAO = "EM_CONVOCACAO"
    PREENCHIDA = "PREENCHIDA"
    ESGOTADA = "ESGOTADA"  # fila acabou sem aceite
    CANCELADA = "CANCELADA"
    EXPIRADA = "EXPIRADA"  # período da aula passou sem aceite


class StatusConvocacao(str, enum.Enum):
    ENVIADA = "ENVIADA"  # na fila de envio / enviada, aguardando resposta
    ACEITA = "ACEITA"
    RECUSADA = "RECUSADA"
    SEM_RESPOSTA = "SEM_RESPOSTA"  # onda expirou sem resposta
    VAGA_PREENCHIDA = "VAGA_PREENCHIDA"  # outro aceitou antes
    CANCELADA = "CANCELADA"  # solicitação cancelada pela escola
    FALHA_ENVIO = "FALHA_ENVIO"
    INELEGIVEL = "INELEGIVEL"  # tentou aceitar, mas já tinha conflito (ex.: aceitou outra vaga)


# Convocações que ainda podem receber resposta válida (SEM_RESPOSTA: aceite tardio).
CONVOCACAO_ABERTA = (
    StatusConvocacao.ENVIADA,
    StatusConvocacao.SEM_RESPOSTA,
    StatusConvocacao.FALHA_ENVIO,
)


class MotivoFimOnda(str, enum.Enum):
    ACEITE = "ACEITE"
    TIMEOUT = "TIMEOUT"
    TODOS_RECUSARAM = "TODOS_RECUSARAM"
    CANCELADA = "CANCELADA"
    EXPIRADA = "EXPIRADA"


class TipoResposta(str, enum.Enum):
    ACEITE = "ACEITE"
    RECUSA = "RECUSA"


class ResultadoResposta(str, enum.Enum):
    VAGA_CONCEDIDA = "VAGA_CONCEDIDA"
    RECUSA_REGISTRADA = "RECUSA_REGISTRADA"
    VAGA_JA_PREENCHIDA = "VAGA_JA_PREENCHIDA"
    SOLICITACAO_ENCERRADA = "SOLICITACAO_ENCERRADA"
    PRAZO_ENCERRADO = "PRAZO_ENCERRADO"
    CONFLITO = "CONFLITO"  # professor ficou inelegível (ex.: aceitou outra vaga)
    JA_RESPONDIDA = "JA_RESPONDIDA"


class Politica(str, enum.Enum):
    MANTER = "MANTER"
    FIM_DA_LISTA = "FIM_DA_LISTA"
    SUSPENDER = "SUSPENDER"


class MotivoPulo(str, enum.Enum):
    INATIVO = "INATIVO"
    SEM_VINCULO_BOT = "SEM_VINCULO_BOT"
    SEM_CONSENTIMENTO = "SEM_CONSENTIMENTO"
    BOT_BLOQUEADO = "BOT_BLOQUEADO"
    SUSPENSO = "SUSPENSO"
    INDISPONIVEL = "INDISPONIVEL"
    CONFLITO_HORARIO = "CONFLITO_HORARIO"
    SUBSTITUICAO_NO_PERIODO = "SUBSTITUICAO_NO_PERIODO"
    LIMITE_SIMULTANEAS = "LIMITE_SIMULTANEAS"
    CARGA_HORARIA = "CARGA_HORARIA"


MOTIVO_PULO_TEXTO = {
    MotivoPulo.INATIVO: "cadastro inativo",
    MotivoPulo.SEM_VINCULO_BOT: "não vinculado ao bot",
    MotivoPulo.SEM_CONSENTIMENTO: "sem consentimento LGPD",
    MotivoPulo.BOT_BLOQUEADO: "bloqueou o bot",
    MotivoPulo.SUSPENSO: "suspenso",
    MotivoPulo.INDISPONIVEL: "declarou indisponibilidade",
    MotivoPulo.CONFLITO_HORARIO: "já em substituição no horário",
    MotivoPulo.SUBSTITUICAO_NO_PERIODO: "já em substituição no período",
    MotivoPulo.LIMITE_SIMULTANEAS: "limite de substituições simultâneas",
    MotivoPulo.CARGA_HORARIA: "carga horária semanal máxima",
}


class StatusOutbox(str, enum.Enum):
    PENDENTE = "PENDENTE"
    ENVIADA = "ENVIADA"
    FALHA = "FALHA"
    DESCARTADA = "DESCARTADA"  # ficou obsoleta antes do envio (ex.: vaga já preenchida)


class Canal(str, enum.Enum):
    TELEGRAM = "TELEGRAM"
    EMAIL = "EMAIL"


# --------------------------------------------------------------------------
# Escolas e usuários
# --------------------------------------------------------------------------

usuario_escola = Table(
    "usuario_escola",
    Base.metadata,
    Column("usuario_id", ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True),
    Column("escola_id", ForeignKey("escola.id", ondelete="CASCADE"), primary_key=True),
)


class Escola(Base):
    __tablename__ = "escola"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(200), unique=True)
    codigo_inep: Mapped[str | None] = mapped_column(String(20), unique=True)
    endereco: Mapped[str | None] = mapped_column(String(300))
    telefone: Mapped[str | None] = mapped_column(String(30))
    ativa: Mapped[bool] = mapped_column(Boolean, default=True)
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    diretores: Mapped[list[Usuario]] = relationship(
        secondary=usuario_escola, back_populates="escolas"
    )


class Usuario(Base):
    __tablename__ = "usuario"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    cpf: Mapped[str | None] = mapped_column(String(11), unique=True)
    telefone: Mapped[str | None] = mapped_column(String(30))
    senha_hash: Mapped[str] = mapped_column(String(100))
    perfil: Mapped[Perfil] = mapped_column(_enum(Perfil))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    ultimo_login_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Incrementado na troca de senha: invalida tokens JWT antigos.
    versao_token: Mapped[int] = mapped_column(Integer, default=0)

    escolas: Mapped[list[Escola]] = relationship(
        secondary=usuario_escola, back_populates="diretores"
    )


class TokenSenha(Base):
    """Token de recuperação de senha (guardamos só o hash)."""

    __tablename__ = "token_senha"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# --------------------------------------------------------------------------
# Professores, habilitações e classificação
# --------------------------------------------------------------------------


class Disciplina(Base):
    __tablename__ = "disciplina"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(100), unique=True)
    # nome normalizado (sem acento, minúsculo) para casar a importação
    chave: Mapped[str] = mapped_column(String(100), unique=True)


class Professor(Base):
    __tablename__ = "professor"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(200))
    cpf: Mapped[str] = mapped_column(String(11), unique=True)
    email: Mapped[str | None] = mapped_column(String(254))
    telefone: Mapped[str | None] = mapped_column(String(30))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    suspenso_ate: Mapped[date | None] = mapped_column(Date)

    # Vínculo com o bot
    telegram_chat_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    vinculado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    codigo_vinculo_hash: Mapped[str | None] = mapped_column(String(64))
    codigo_vinculo_expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bot_bloqueado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # LGPD
    consentimento_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consentimento_revogado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    habilitacoes: Mapped[list[Habilitacao]] = relationship(
        back_populates="professor", cascade="all, delete-orphan"
    )

    @property
    def tem_consentimento(self) -> bool:
        return self.consentimento_em is not None and self.consentimento_revogado_em is None


class Habilitacao(Base):
    __tablename__ = "habilitacao"
    __table_args__ = (UniqueConstraint("professor_id", "etapa", "disciplina_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professor.id", ondelete="CASCADE"))
    etapa: Mapped[Etapa] = mapped_column(_enum(Etapa))
    disciplina_id: Mapped[int] = mapped_column(ForeignKey("disciplina.id"))

    professor: Mapped[Professor] = relationship(back_populates="habilitacoes")
    disciplina: Mapped[Disciplina] = relationship()


class ListaClassificacao(Base):
    __tablename__ = "lista_classificacao"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(200))
    edital: Mapped[str | None] = mapped_column(String(200))
    ativa: Mapped[bool] = mapped_column(Boolean, default=False)
    arquivo_nome: Mapped[str | None] = mapped_column(String(255))
    arquivo_sha256: Mapped[str | None] = mapped_column(String(64))
    importada_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"))
    importada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    __table_args__ = (
        # No máximo uma lista ativa.
        Index("uq_lista_ativa", "ativa", unique=True, postgresql_where=text("ativa")),
    )


class Classificacao(Base):
    __tablename__ = "classificacao"
    __table_args__ = (
        UniqueConstraint("lista_id", "posicao"),
        UniqueConstraint("lista_id", "professor_id"),
        CheckConstraint("posicao > 0"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    lista_id: Mapped[int] = mapped_column(ForeignKey("lista_classificacao.id", ondelete="CASCADE"))
    professor_id: Mapped[int] = mapped_column(ForeignKey("professor.id"))
    posicao: Mapped[int] = mapped_column(Integer)  # posição oficial: imutável
    # Política FIM_DA_LISTA: quem tem rebaixado_em vai depois de todos, na ordem do rebaixamento.
    rebaixado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    professor: Mapped[Professor] = relationship()
    lista: Mapped[ListaClassificacao] = relationship()


class Indisponibilidade(Base):
    __tablename__ = "indisponibilidade"
    __table_args__ = (CheckConstraint("data_fim >= data_inicio"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professor.id", ondelete="CASCADE"))
    data_inicio: Mapped[date] = mapped_column(Date)
    data_fim: Mapped[date] = mapped_column(Date)
    motivo: Mapped[str | None] = mapped_column(String(300))
    origem: Mapped[str] = mapped_column(String(10), default="BOT")
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)


# --------------------------------------------------------------------------
# Regras configuráveis (linha única, id = 1)
# --------------------------------------------------------------------------


class Configuracao(Base):
    __tablename__ = "configuracao"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    tamanho_onda: Mapped[int] = mapped_column(Integer, default=3)
    timeout_minutos: Mapped[int] = mapped_column(Integer, default=15)
    timeout_minutos_urgente: Mapped[int] = mapped_column(Integer, default=5)
    aceitar_resposta_tardia: Mapped[bool] = mapped_column(Boolean, default=True)
    politica_recusa: Mapped[Politica] = mapped_column(_enum(Politica), default=Politica.MANTER)
    dias_suspensao_recusa: Mapped[int] = mapped_column(Integer, default=0)
    politica_sem_resposta: Mapped[Politica] = mapped_column(
        _enum(Politica), default=Politica.MANTER
    )
    dias_suspensao_sem_resposta: Mapped[int] = mapped_column(Integer, default=0)
    exclusividade_no_periodo: Mapped[bool] = mapped_column(Boolean, default=False)
    max_substituicoes_simultaneas: Mapped[int | None] = mapped_column(Integer)
    carga_horaria_max_semanal: Mapped[int | None] = mapped_column(Integer)
    atualizada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    atualizada_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"))


# --------------------------------------------------------------------------
# Solicitação, ondas, convocações e respostas
# --------------------------------------------------------------------------


class Solicitacao(Base):
    __tablename__ = "solicitacao"
    __table_args__ = (
        CheckConstraint("data_fim >= data_inicio"),
        CheckConstraint("hora_fim > hora_inicio"),
        Index("ix_solicitacao_escola_status", "escola_id", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    escola_id: Mapped[int] = mapped_column(ForeignKey("escola.id"))
    criada_por_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    lista_id: Mapped[int] = mapped_column(ForeignKey("lista_classificacao.id"))
    disciplina_id: Mapped[int] = mapped_column(ForeignKey("disciplina.id"))
    etapa: Mapped[Etapa] = mapped_column(_enum(Etapa))
    turma: Mapped[str] = mapped_column(String(50))
    turno: Mapped[Turno] = mapped_column(_enum(Turno))
    data_inicio: Mapped[date] = mapped_column(Date)
    data_fim: Mapped[date] = mapped_column(Date)
    hora_inicio: Mapped[time] = mapped_column(Time)
    hora_fim: Mapped[time] = mapped_column(Time)
    motivo: Mapped[str | None] = mapped_column(String(300))
    observacoes: Mapped[str | None] = mapped_column(Text)
    urgente: Mapped[bool] = mapped_column(Boolean, default=False)
    timeout_minutos: Mapped[int] = mapped_column(Integer)  # snapshot da configuração

    status: Mapped[StatusSolicitacao] = mapped_column(_enum(StatusSolicitacao))
    ciclo: Mapped[int] = mapped_column(Integer, default=1)  # incrementa ao reabrir
    professor_aceito_id: Mapped[int | None] = mapped_column(ForeignKey("professor.id"))
    preenchida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    encerrada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    motivo_cancelamento: Mapped[str | None] = mapped_column(String(300))
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    escola: Mapped[Escola] = relationship()
    disciplina: Mapped[Disciplina] = relationship()
    criada_por: Mapped[Usuario] = relationship()
    professor_aceito: Mapped[Professor | None] = relationship()
    ondas: Mapped[list[Onda]] = relationship(
        back_populates="solicitacao", order_by="Onda.numero"
    )


class Onda(Base):
    __tablename__ = "onda"
    __table_args__ = (
        UniqueConstraint("solicitacao_id", "ciclo", "numero"),
        Index("ix_onda_aberta_expira", "expira_em", postgresql_where=text("encerrada_em IS NULL")),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    solicitacao_id: Mapped[int] = mapped_column(ForeignKey("solicitacao.id"))
    ciclo: Mapped[int] = mapped_column(Integer)
    numero: Mapped[int] = mapped_column(Integer)
    iniciada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    encerrada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    motivo_encerramento: Mapped[MotivoFimOnda | None] = mapped_column(_enum(MotivoFimOnda))

    solicitacao: Mapped[Solicitacao] = relationship(back_populates="ondas")
    convocacoes: Mapped[list[Convocacao]] = relationship(
        back_populates="onda", order_by="Convocacao.ordem"
    )
    pulos: Mapped[list[OndaPulo]] = relationship(order_by="OndaPulo.ordem")


class OndaPulo(Base):
    """Professor à frente na fila que NÃO foi acionado nesta onda, e por quê.

    É a evidência de que a ordem de classificação foi respeitada.
    """

    __tablename__ = "onda_pulo"
    id: Mapped[int] = mapped_column(primary_key=True)
    onda_id: Mapped[int] = mapped_column(ForeignKey("onda.id"))
    professor_id: Mapped[int] = mapped_column(ForeignKey("professor.id"))
    posicao: Mapped[int] = mapped_column(Integer)
    ordem: Mapped[int] = mapped_column(Integer)  # ordem efetiva na fila
    motivo: Mapped[MotivoPulo] = mapped_column(_enum(MotivoPulo))

    professor: Mapped[Professor] = relationship()


class Convocacao(Base):
    __tablename__ = "convocacao"
    __table_args__ = (
        UniqueConstraint("solicitacao_id", "ciclo", "professor_id"),
        # Defesa em profundidade: no máximo um aceite por solicitação/ciclo.
        Index(
            "uq_convocacao_um_aceite",
            "solicitacao_id",
            "ciclo",
            unique=True,
            postgresql_where=text("status = 'ACEITA'"),
        ),
        Index("ix_convocacao_professor_status", "professor_id", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    solicitacao_id: Mapped[int] = mapped_column(ForeignKey("solicitacao.id"))
    onda_id: Mapped[int] = mapped_column(ForeignKey("onda.id"))
    ciclo: Mapped[int] = mapped_column(Integer)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professor.id"))
    posicao: Mapped[int] = mapped_column(Integer)  # snapshot da posição oficial
    ordem: Mapped[int] = mapped_column(Integer)  # ordem efetiva na fila
    status: Mapped[StatusConvocacao] = mapped_column(_enum(StatusConvocacao))
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    enviada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    respondida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tempo_resposta_s: Mapped[int | None] = mapped_column(Integer)
    penalidade_aplicada: Mapped[str | None] = mapped_column(String(40))
    telegram_message_id: Mapped[int | None] = mapped_column(BigInteger)

    solicitacao: Mapped[Solicitacao] = relationship()
    onda: Mapped[Onda] = relationship(back_populates="convocacoes")
    professor: Mapped[Professor] = relationship()
    respostas: Mapped[list[Resposta]] = relationship(order_by="Resposta.id")


class Resposta(Base):
    """Cada clique/resposta recebida, inclusive as tardias e as repetidas."""

    __tablename__ = "resposta"
    id: Mapped[int] = mapped_column(primary_key=True)
    convocacao_id: Mapped[int] = mapped_column(ForeignKey("convocacao.id"))
    tipo: Mapped[TipoResposta] = mapped_column(_enum(TipoResposta))
    recebida_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    canal: Mapped[Canal] = mapped_column(_enum(Canal), default=Canal.TELEGRAM)
    resultado: Mapped[ResultadoResposta] = mapped_column(_enum(ResultadoResposta))


# --------------------------------------------------------------------------
# Mensageria (transactional outbox), bot e logs
# --------------------------------------------------------------------------


class OutboxMensagem(Base):
    __tablename__ = "outbox_mensagem"
    __table_args__ = (
        Index(
            "ix_outbox_pendente",
            "proxima_tentativa_em",
            postgresql_where=text("status = 'PENDENTE'"),
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    canal: Mapped[Canal] = mapped_column(_enum(Canal))
    destino: Mapped[str] = mapped_column(String(254))  # chat_id ou e-mail
    tipo: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSONType)
    convocacao_id: Mapped[int | None] = mapped_column(ForeignKey("convocacao.id"))
    professor_id: Mapped[int | None] = mapped_column(ForeignKey("professor.id"))
    status: Mapped[StatusOutbox] = mapped_column(_enum(StatusOutbox), default=StatusOutbox.PENDENTE)
    tentativas: Mapped[int] = mapped_column(Integer, default=0)
    proxima_tentativa_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    ultimo_erro: Mapped[str | None] = mapped_column(Text)
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    enviada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BotSessao(Base):
    """Estado da conversa do bot por chat (fluxo de vínculo)."""

    __tablename__ = "bot_sessao"
    chat_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    estado: Mapped[str] = mapped_column(String(30), default="")
    dados: Mapped[dict] = mapped_column(JSONType, default=dict)
    tentativas_vinculo: Mapped[int] = mapped_column(Integer, default=0)
    janela_tentativas_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)


class LogAuditoria(Base):
    """Log somente-inserção (trigger bloqueia UPDATE/DELETE) com hash encadeado."""

    __tablename__ = "log_auditoria"
    __table_args__ = (
        Index("ix_log_entidade", "entidade", "entidade_id"),
        Index("ix_log_escola", "escola_id"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ocorrido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ator_tipo: Mapped[str] = mapped_column(String(12))  # USUARIO | PROFESSOR | SISTEMA
    ator_id: Mapped[int | None] = mapped_column(Integer)
    acao: Mapped[str] = mapped_column(String(60))
    entidade: Mapped[str] = mapped_column(String(40))
    entidade_id: Mapped[int | None] = mapped_column(Integer)
    escola_id: Mapped[int | None] = mapped_column(Integer)
    dados: Mapped[dict] = mapped_column(JSONType, default=dict)
    ip: Mapped[str | None] = mapped_column(String(45))
    hash_anterior: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64), unique=True)


class LogAcesso(Base):
    """LGPD: registro de acesso ao painel (quem, o quê, quando, de onde)."""

    __tablename__ = "log_acesso"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ocorrido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    usuario_id: Mapped[int | None] = mapped_column(Integer, index=True)
    metodo: Mapped[str] = mapped_column(String(8))
    rota: Mapped[str] = mapped_column(String(300))
    status_http: Mapped[int] = mapped_column(Integer)
    ip: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(300))
