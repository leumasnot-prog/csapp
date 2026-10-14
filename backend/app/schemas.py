from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import (
    Etapa,
    MotivoFimOnda,
    MotivoPulo,
    Perfil,
    Politica,
    StatusConvocacao,
    StatusSolicitacao,
    Turno,
)
from .services.cpf import cpf_valido, somente_digitos


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _cpf_opcional(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    d = somente_digitos(v)
    if not cpf_valido(d):
        raise ValueError("CPF inválido")
    return d


# ---------------------------------------------------------------- auth

class LoginIn(BaseModel):
    login: str = Field(description="E-mail ou CPF")
    senha: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class EsqueciSenhaIn(BaseModel):
    email: EmailStr


class RedefinirSenhaIn(BaseModel):
    token: str
    nova_senha: str = Field(min_length=8, max_length=128)


class AlterarSenhaIn(BaseModel):
    senha_atual: str
    nova_senha: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------- escolas / usuários

class EscolaIn(BaseModel):
    nome: str = Field(min_length=3, max_length=200)
    codigo_inep: str | None = Field(default=None, max_length=20)
    endereco: str | None = Field(default=None, max_length=300)
    telefone: str | None = Field(default=None, max_length=30)
    ativa: bool = True


class EscolaOut(ORM):
    id: int
    nome: str
    codigo_inep: str | None
    endereco: str | None
    telefone: str | None
    ativa: bool


class EscolaResumo(ORM):
    id: int
    nome: str


class UsuarioIn(BaseModel):
    nome: str = Field(min_length=3, max_length=200)
    email: EmailStr
    cpf: str | None = None
    telefone: str | None = Field(default=None, max_length=30)
    perfil: Perfil = Perfil.DIRETOR
    escola_ids: list[int] = []
    ativo: bool = True
    senha: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("cpf")
    @classmethod
    def _validar_cpf(cls, v):
        return _cpf_opcional(v)


class UsuarioOut(ORM):
    id: int
    nome: str
    email: str
    perfil: Perfil
    ativo: bool
    telefone: str | None = None
    escolas: list[EscolaResumo] = []
    ultimo_login_em: datetime | None = None


# ---------------------------------------------------------------- professores

class DisciplinaOut(ORM):
    id: int
    nome: str


class DisciplinaIn(BaseModel):
    nome: str = Field(min_length=2, max_length=100)


class HabilitacaoIO(BaseModel):
    etapa: Etapa
    disciplina_id: int


class ProfessorIn(BaseModel):
    nome: str = Field(min_length=3, max_length=200)
    cpf: str | None = None  # obrigatório na criação; vazio na edição = manter
    email: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=30)
    ativo: bool = True
    suspenso_ate: date | None = None
    habilitacoes: list[HabilitacaoIO] = []

    @field_validator("cpf")
    @classmethod
    def _validar_cpf(cls, v):
        return _cpf_opcional(v)


class ProfessorOut(BaseModel):
    id: int
    nome: str
    cpf_mascarado: str
    email: str | None
    telefone: str | None
    ativo: bool
    suspenso_ate: date | None
    vinculado_bot: bool
    consentimento: bool
    bot_bloqueado: bool
    habilitacoes: list[dict]
    posicao: int | None = None


class CodigoVinculoOut(BaseModel):
    codigo: str
    expira_em: datetime
    instrucoes: str


# ---------------------------------------------------------------- listas

class ListaOut(ORM):
    id: int
    nome: str
    edital: str | None
    ativa: bool
    arquivo_nome: str | None
    arquivo_sha256: str | None
    importada_em: datetime


class ProblemaOut(BaseModel):
    linha: int
    campo: str
    mensagem: str


class ImportacaoOut(BaseModel):
    ok: bool
    confirmado: bool
    total_linhas: int
    erros: list[ProblemaOut]
    avisos: list[ProblemaOut]
    professores_novos: int
    professores_atualizados: int
    disciplinas_novas: list[str]
    lista_id: int | None
    previa: list[dict]


# ---------------------------------------------------------------- configuração

class ConfiguracaoIO(ORM):
    tamanho_onda: int = Field(ge=1, le=20)
    timeout_minutos: int = Field(ge=1, le=24 * 60)
    timeout_minutos_urgente: int = Field(ge=1, le=24 * 60)
    aceitar_resposta_tardia: bool
    politica_recusa: Politica
    dias_suspensao_recusa: int = Field(ge=0, le=365)
    politica_sem_resposta: Politica
    dias_suspensao_sem_resposta: int = Field(ge=0, le=365)
    exclusividade_no_periodo: bool
    max_substituicoes_simultaneas: int | None = Field(default=None, ge=1, le=50)
    carga_horaria_max_semanal: int | None = Field(default=None, ge=1, le=80)


# ---------------------------------------------------------------- solicitações

class SolicitacaoIn(BaseModel):
    escola_id: int
    disciplina_id: int
    etapa: Etapa
    turma: str = Field(min_length=1, max_length=50)
    turno: Turno
    data_inicio: date
    data_fim: date
    hora_inicio: time
    hora_fim: time
    motivo: str | None = Field(default=None, max_length=300)
    observacoes: str | None = Field(default=None, max_length=2000)
    urgente: bool = False


class CancelarIn(BaseModel):
    motivo: str | None = Field(default=None, max_length=300)


class ProfessorAceitoOut(BaseModel):
    nome: str
    telefone: str | None
    email: str | None


class SolicitacaoResumo(BaseModel):
    id: int
    escola: EscolaResumo
    disciplina: str
    etapa: Etapa
    turma: str
    turno: Turno
    data_inicio: date
    data_fim: date
    hora_inicio: time
    hora_fim: time
    urgente: bool
    status: StatusSolicitacao
    ciclo: int
    criada_em: datetime
    preenchida_em: datetime | None
    professor_aceito: str | None
    onda_atual: int | None = None
    expira_em: datetime | None = None


class ConvocacaoOut(BaseModel):
    id: int
    professor: str
    posicao: int
    ordem: int
    status: StatusConvocacao
    status_texto: str
    criada_em: datetime
    enviada_em: datetime | None
    respondida_em: datetime | None
    tempo_resposta_s: int | None


class PuloOut(BaseModel):
    professor: str
    posicao: int
    ordem: int
    motivo: MotivoPulo
    motivo_texto: str


class OndaOut(BaseModel):
    id: int
    ciclo: int
    numero: int
    iniciada_em: datetime
    expira_em: datetime
    encerrada_em: datetime | None
    motivo_encerramento: MotivoFimOnda | None
    convocacoes: list[ConvocacaoOut]
    pulos: list[PuloOut]


class SolicitacaoDetalhe(SolicitacaoResumo):
    motivo: str | None
    observacoes: str | None
    timeout_minutos: int
    motivo_cancelamento: str | None
    encerrada_em: datetime | None
    criada_por: str
    contato_professor: ProfessorAceitoOut | None
    ondas: list[OndaOut]


TokenOut.model_rebuild()
