"""Motor de convocação por ondas.

Regra de concorrência: TODA transição de estado de uma vaga começa travando a
linha da solicitação (`SELECT ... FOR UPDATE`). Aceite, recusa, timeout,
cancelamento e reabertura ficam serializados por vaga. Depois desse lock, a
transação pode travar linhas de professor, sempre em ordem crescente de id. O
advisory lock da auditoria vem por último, no commit. Essa ordem fixa evita
deadlock.

As funções recebem a sessão e NÃO fazem commit. Quem chama (API, bot, worker)
controla a transação.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import audit
from ..models import (
    CONVOCACAO_ABERTA,
    Classificacao,
    Configuracao,
    Convocacao,
    ListaClassificacao,
    MotivoFimOnda,
    Onda,
    OndaPulo,
    Politica,
    Professor,
    Resposta,
    ResultadoResposta,
    Solicitacao,
    StatusConvocacao,
    StatusSolicitacao,
    TipoResposta,
    Usuario,
)
from ..tempo import agora, combinar, hoje
from . import configuracao, elegibilidade, notificacoes

ESTADOS_FINAIS = (
    StatusSolicitacao.PREENCHIDA,
    StatusSolicitacao.ESGOTADA,
    StatusSolicitacao.CANCELADA,
    StatusSolicitacao.EXPIRADA,
)


class ErroNegocio(Exception):
    """Erro de regra de negócio, com mensagem para o usuário."""


@dataclass
class ResultadoResponder:
    resultado: ResultadoResposta
    mensagem: str


# ------------------------------------------------------------------ locks

def travar_solicitacao(s: Session, solicitacao_id: int, *, skip_locked: bool = False
                       ) -> Solicitacao | None:
    q = (select(Solicitacao).where(Solicitacao.id == solicitacao_id)
         .with_for_update(skip_locked=skip_locked)
         .execution_options(populate_existing=True))
    return s.execute(q).scalar_one_or_none()


def _travar_professores(s: Session, ids: set[int]) -> dict[int, Professor]:
    if not ids:
        return {}
    profs = s.execute(
        select(Professor).where(Professor.id.in_(ids)).order_by(Professor.id)
        .with_for_update().execution_options(populate_existing=True)
    ).scalars().all()
    return {p.id: p for p in profs}


def _recarregar(s: Session, obj):
    s.refresh(obj)
    return obj


# ------------------------------------------------------------------ criação

def criar_solicitacao(s: Session, usuario: Usuario, *, escola_id: int, disciplina_id: int,
                      etapa, turma: str, turno, data_inicio, data_fim, hora_inicio, hora_fim,
                      motivo: str | None = None, observacoes: str | None = None,
                      urgente: bool = False, ip: str | None = None) -> Solicitacao:
    if data_fim < data_inicio:
        raise ErroNegocio("A data final deve ser igual ou posterior à data inicial.")
    if hora_fim <= hora_inicio:
        raise ErroNegocio("O horário final deve ser posterior ao inicial.")
    if combinar(data_fim, hora_fim) <= agora():
        raise ErroNegocio("O período informado já terminou.")
    lista = s.execute(
        select(ListaClassificacao).where(ListaClassificacao.ativa.is_(True))
    ).scalar_one_or_none()
    if lista is None:
        raise ErroNegocio("Não há lista de classificação ativa. Contate a Secretaria.")
    cfg = configuracao.obter(s)
    sol = Solicitacao(
        escola_id=escola_id, criada_por_id=usuario.id, lista_id=lista.id,
        disciplina_id=disciplina_id, etapa=etapa, turma=turma.strip(), turno=turno,
        data_inicio=data_inicio, data_fim=data_fim, hora_inicio=hora_inicio,
        hora_fim=hora_fim, motivo=motivo, observacoes=observacoes, urgente=urgente,
        timeout_minutos=cfg.timeout_minutos_urgente if urgente else cfg.timeout_minutos,
        status=StatusSolicitacao.EM_CONVOCACAO, ciclo=1,
    )
    s.add(sol)
    s.flush()
    audit.registrar(s, "SOLICITACAO_CRIADA", "solicitacao", sol.id, ator_tipo="USUARIO",
                    ator_id=usuario.id, escola_id=escola_id, ip=ip, dados={
                        "lista_id": lista.id, "etapa": sol.etapa.value,
                        "disciplina_id": disciplina_id, "turma": sol.turma,
                        "periodo": [sol.data_inicio, sol.data_fim],
                        "horario": [sol.hora_inicio, sol.hora_fim],
                        "urgente": urgente, "timeout_minutos": sol.timeout_minutos,
                    })
    # A solicitação recém-criada ainda não é visível a outras transações, mas
    # o lock deixa o caminho idêntico ao das demais transições.
    travar_solicitacao(s, sol.id)
    disparar_proxima_onda(s, sol, cfg)
    return sol


# ------------------------------------------------------------------ ondas

def _onda_aberta(s: Session, sol: Solicitacao) -> Onda | None:
    return s.execute(
        select(Onda).where(Onda.solicitacao_id == sol.id, Onda.ciclo == sol.ciclo,
                           Onda.encerrada_em.is_(None))
    ).scalar_one_or_none()


def _fechar_onda(onda: Onda | None, motivo: MotivoFimOnda) -> None:
    if onda is not None and onda.encerrada_em is None:
        onda.encerrada_em = agora()
        onda.motivo_encerramento = motivo


def disparar_proxima_onda(s: Session, sol: Solicitacao, cfg: Configuracao | None = None
                          ) -> Onda | None:
    """Pré-condição: solicitação travada e EM_CONVOCACAO, sem onda aberta."""
    cfg = cfg or configuracao.obter(s)
    selecao = elegibilidade.selecionar(s, sol, cfg, cfg.tamanho_onda)
    if not selecao.escolhidos:
        _encerrar(s, sol, StatusSolicitacao.ESGOTADA, cfg)
        notificacoes.fila_esgotada(s, sol)
        audit.registrar(s, "FILA_ESGOTADA", "solicitacao", sol.id, escola_id=sol.escola_id,
                        dados={"ciclo": sol.ciclo, "pulos": [
                            {"professor_id": it.professor.id, "posicao": it.classificacao.posicao,
                             "motivo": m.value} for it, m in selecao.pulos]})
        return None

    numero = (s.execute(
        select(func.max(Onda.numero)).where(Onda.solicitacao_id == sol.id,
                                            Onda.ciclo == sol.ciclo)
    ).scalar() or 0) + 1
    inicio = agora()
    onda = Onda(solicitacao_id=sol.id, ciclo=sol.ciclo, numero=numero, iniciada_em=inicio,
                expira_em=inicio + timedelta(minutes=sol.timeout_minutos))
    s.add(onda)
    s.flush()
    for it, motivo in selecao.pulos:
        s.add(OndaPulo(onda_id=onda.id, professor_id=it.professor.id,
                       posicao=it.classificacao.posicao, ordem=it.ordem, motivo=motivo))
    convs = []
    for it in selecao.escolhidos:
        conv = Convocacao(solicitacao_id=sol.id, onda_id=onda.id, ciclo=sol.ciclo,
                          professor_id=it.professor.id, posicao=it.classificacao.posicao,
                          ordem=it.ordem, status=StatusConvocacao.ENVIADA, criada_em=inicio)
        conv.professor = it.professor
        conv.solicitacao = sol
        s.add(conv)
        convs.append(conv)
    s.flush()
    for conv in convs:
        notificacoes.convocacao(s, conv, onda.expira_em)
    audit.registrar(s, "ONDA_DISPARADA", "onda", onda.id, escola_id=sol.escola_id, dados={
        "solicitacao_id": sol.id, "ciclo": sol.ciclo, "numero": numero,
        "expira_em": onda.expira_em,
        "convocados": [{"professor_id": c.professor_id, "posicao": c.posicao,
                        "ordem": c.ordem, "convocacao_id": c.id} for c in convs],
        "pulos": [{"professor_id": it.professor.id, "posicao": it.classificacao.posicao,
                   "ordem": it.ordem, "motivo": m.value} for it, m in selecao.pulos],
    })
    return onda


def _avancar_se_onda_concluida(s: Session, sol: Solicitacao, cfg: Configuracao) -> None:
    """Se ninguém da onda atual ainda pode responder dentro do prazo, dispara a
    próxima imediatamente (não espera o timeout)."""
    if sol.status != StatusSolicitacao.EM_CONVOCACAO:
        return
    onda = _onda_aberta(s, sol)
    if onda is None:
        return
    pendentes = s.execute(
        select(func.count()).select_from(Convocacao).where(
            Convocacao.onda_id == onda.id, Convocacao.status == StatusConvocacao.ENVIADA)
    ).scalar()
    if pendentes == 0:
        _fechar_onda(onda, MotivoFimOnda.TODOS_RECUSARAM)
        disparar_proxima_onda(s, sol, cfg)


# ------------------------------------------------------------------ penalidades

def _penalizar(s: Session, conv: Convocacao, prof: Professor, politica: Politica,
               dias: int, causa: str) -> None:
    """Pré-condição: professor travado."""
    if politica == Politica.MANTER:
        return
    sol = conv.solicitacao
    if politica == Politica.FIM_DA_LISTA:
        classif = s.execute(
            select(Classificacao).where(Classificacao.lista_id == sol.lista_id,
                                        Classificacao.professor_id == prof.id)
        ).scalar_one_or_none()
        if classif is None:
            return
        classif.rebaixado_em = agora()
        conv.penalidade_aplicada = "FIM_DA_LISTA"
    elif politica == Politica.SUSPENDER and dias > 0:
        ate = hoje() + timedelta(days=dias)
        if prof.suspenso_ate is None or prof.suspenso_ate < ate:
            prof.suspenso_ate = ate
        conv.penalidade_aplicada = f"SUSPENSO_ATE_{ate.isoformat()}"
    else:
        return
    audit.registrar(s, "PENALIDADE_APLICADA", "professor", prof.id, escola_id=sol.escola_id,
                    dados={"causa": causa, "politica": politica.value, "dias": dias,
                           "convocacao_id": conv.id, "solicitacao_id": sol.id,
                           "resultado": conv.penalidade_aplicada})


def _encerrar(s: Session, sol: Solicitacao, status: StatusSolicitacao,
              cfg: Configuracao, *, ja_travados: dict[int, Professor] | None = None) -> None:
    """Fecha a solicitação. Quem ficou sem responder no ciclo recebe a
    penalidade de "sem resposta" (exceto em cancelamento)."""
    sol.status = status
    sol.encerrada_em = agora()
    motivo_onda = {
        StatusSolicitacao.PREENCHIDA: MotivoFimOnda.ACEITE,
        StatusSolicitacao.CANCELADA: MotivoFimOnda.CANCELADA,
        StatusSolicitacao.EXPIRADA: MotivoFimOnda.EXPIRADA,
    }.get(status)
    if motivo_onda:
        _fechar_onda(_onda_aberta(s, sol), motivo_onda)
    if status == StatusSolicitacao.CANCELADA or cfg.politica_sem_resposta == Politica.MANTER:
        return
    sem_resposta = s.execute(
        select(Convocacao).where(Convocacao.solicitacao_id == sol.id,
                                 Convocacao.ciclo == sol.ciclo,
                                 Convocacao.status == StatusConvocacao.SEM_RESPOSTA)
    ).scalars().all()
    ids = {c.professor_id for c in sem_resposta} - set(ja_travados or {})
    travados = dict(ja_travados or {})
    travados.update(_travar_professores(s, ids))
    for conv in sorted(sem_resposta, key=lambda c: c.professor_id):
        _penalizar(s, conv, travados[conv.professor_id], cfg.politica_sem_resposta,
                   cfg.dias_suspensao_sem_resposta, "SEM_RESPOSTA")


# ------------------------------------------------------------------ respostas

def responder(s: Session, convocacao_id: int, professor_id: int, tipo: TipoResposta
              ) -> ResultadoResponder:
    conv = s.get(Convocacao, convocacao_id)
    if conv is None or conv.professor_id != professor_id:
        raise ErroNegocio("Convocação não encontrada.")
    sol = travar_solicitacao(s, conv.solicitacao_id)
    conv = _recarregar(s, conv)  # estado após o lock
    cfg = configuracao.obter(s)
    agora_ = agora()

    def registrar(resultado: ResultadoResposta, msg: str) -> ResultadoResponder:
        s.add(Resposta(convocacao_id=conv.id, tipo=tipo, recebida_em=agora_,
                       resultado=resultado))
        audit.registrar(s, f"RESPOSTA_{tipo.value}", "convocacao", conv.id,
                        ator_tipo="PROFESSOR", ator_id=professor_id, escola_id=sol.escola_id,
                        dados={"solicitacao_id": sol.id, "resultado": resultado.value,
                               "status_convocacao": conv.status.value})
        return ResultadoResponder(resultado, msg)

    # Resposta repetida ou a uma convocação já encerrada
    if conv.status == StatusConvocacao.ACEITA:
        return registrar(ResultadoResposta.JA_RESPONDIDA, "Você já aceitou esta vaga. ✅")
    if conv.status in (StatusConvocacao.RECUSADA, StatusConvocacao.INELEGIVEL):
        return registrar(ResultadoResposta.JA_RESPONDIDA, "Sua resposta já foi registrada.")
    if conv.ciclo != sol.ciclo or conv.status == StatusConvocacao.CANCELADA:
        return registrar(ResultadoResposta.SOLICITACAO_ENCERRADA,
                         "Esta convocação foi encerrada.")
    if sol.status == StatusSolicitacao.PREENCHIDA or conv.status == StatusConvocacao.VAGA_PREENCHIDA:
        return registrar(ResultadoResposta.VAGA_JA_PREENCHIDA,
                         "Esta vaga já foi preenchida. Obrigado!")
    if sol.status != StatusSolicitacao.EM_CONVOCACAO:
        return registrar(ResultadoResposta.SOLICITACAO_ENCERRADA,
                         "Esta convocação foi encerrada.")

    tardia = conv.status == StatusConvocacao.SEM_RESPOSTA

    def marcar(status: StatusConvocacao) -> None:
        conv.status = status
        conv.respondida_em = agora_
        conv.tempo_resposta_s = int((agora_ - conv.criada_em).total_seconds())

    # Trava o professor e, se houver penalidade por falta de resposta, também
    # quem pode ser penalizado caso a vaga se encerre nesta transação. Tudo de
    # uma vez, em ordem crescente de id.
    ids = {professor_id}
    if cfg.politica_sem_resposta != Politica.MANTER:
        ids |= set(s.execute(
            select(Convocacao.professor_id).where(
                Convocacao.solicitacao_id == sol.id, Convocacao.ciclo == sol.ciclo,
                Convocacao.status == StatusConvocacao.SEM_RESPOSTA)
        ).scalars())
    travados = _travar_professores(s, ids)

    if tipo == TipoResposta.RECUSA:
        prof = travados[professor_id]
        marcar(StatusConvocacao.RECUSADA)
        _penalizar(s, conv, prof, cfg.politica_recusa, cfg.dias_suspensao_recusa, "RECUSA")
        r = registrar(ResultadoResposta.RECUSA_REGISTRADA, "Recusa registrada. Obrigado!")
        s.flush()
        _avancar_se_onda_concluida(s, sol, cfg)
        return r

    # ACEITE
    if tardia and not cfg.aceitar_resposta_tardia:
        return registrar(ResultadoResposta.PRAZO_ENCERRADO,
                         "O prazo para responder a esta convocação terminou.")

    conflito = elegibilidade.conflito_no_aceite(s, sol, cfg, professor_id)
    if conflito is not None:
        marcar(StatusConvocacao.INELEGIVEL)
        r = registrar(ResultadoResposta.CONFLITO,
                      "Não foi possível confirmar: você já tem substituição aceita que "
                      "conflita com esta vaga.")
        s.flush()
        _avancar_se_onda_concluida(s, sol, cfg)
        return r

    marcar(StatusConvocacao.ACEITA)
    sol.professor_aceito_id = professor_id
    sol.preenchida_em = agora_
    s.flush()  # o índice único parcial é a segunda barreira contra aceite duplo

    outras = s.execute(
        select(Convocacao).where(Convocacao.solicitacao_id == sol.id,
                                 Convocacao.ciclo == sol.ciclo,
                                 Convocacao.id != conv.id,
                                 Convocacao.status.in_(CONVOCACAO_ABERTA))
    ).scalars().all()
    for outra in outras:
        if outra.status != StatusConvocacao.SEM_RESPOSTA:
            outra.status = StatusConvocacao.VAGA_PREENCHIDA
        notificacoes.vaga_preenchida(s, outra)

    _encerrar(s, sol, StatusSolicitacao.PREENCHIDA, cfg, ja_travados=travados)
    notificacoes.aceite_confirmado(s, conv)
    notificacoes.diretor_preenchida(s, sol, travados[professor_id])
    audit.registrar(s, "VAGA_PREENCHIDA", "solicitacao", sol.id, escola_id=sol.escola_id,
                    dados={"professor_id": professor_id, "convocacao_id": conv.id,
                           "posicao": conv.posicao, "aceite_tardio": tardia,
                           "tempo_resposta_s": conv.tempo_resposta_s})
    return registrar(ResultadoResposta.VAGA_CONCEDIDA, "✅ Vaga confirmada para você!")


def falha_envio(s: Session, convocacao_id: int, erro: str) -> None:
    """O worker desistiu de entregar a convocação (ex.: professor bloqueou o bot)."""
    conv = s.get(Convocacao, convocacao_id)
    if conv is None:
        return
    sol = travar_solicitacao(s, conv.solicitacao_id)
    conv = _recarregar(s, conv)
    if conv.status != StatusConvocacao.ENVIADA:
        return
    conv.status = StatusConvocacao.FALHA_ENVIO
    audit.registrar(s, "FALHA_ENVIO", "convocacao", conv.id, escola_id=sol.escola_id,
                    dados={"solicitacao_id": sol.id, "erro": erro[:300]})
    s.flush()
    if conv.ciclo == sol.ciclo:
        _avancar_se_onda_concluida(s, sol, configuracao.obter(s))


# ------------------------------------------------------------------ timeouts

def ondas_vencidas(s: Session, limite: int = 100) -> list[int]:
    """IDs de solicitações com onda aberta e vencida (sem lock: só candidatas)."""
    return list(s.execute(
        select(Onda.solicitacao_id).where(Onda.encerrada_em.is_(None),
                                          Onda.expira_em <= agora())
        .order_by(Onda.expira_em).limit(limite)
    ).scalars())


def processar_timeout(s: Session, solicitacao_id: int) -> bool:
    """Fecha a onda vencida e dispara a próxima. Retorna False se outra
    transação está mexendo na solicitação (tenta de novo no próximo ciclo)."""
    sol = travar_solicitacao(s, solicitacao_id, skip_locked=True)
    if sol is None:
        return False
    if sol.status != StatusSolicitacao.EM_CONVOCACAO:
        return True
    onda = _onda_aberta(s, sol)
    if onda is None or onda.expira_em > agora():
        return True
    for conv in s.execute(
        select(Convocacao).where(Convocacao.onda_id == onda.id,
                                 Convocacao.status == StatusConvocacao.ENVIADA)
    ).scalars():
        conv.status = StatusConvocacao.SEM_RESPOSTA
    _fechar_onda(onda, MotivoFimOnda.TIMEOUT)
    audit.registrar(s, "ONDA_TIMEOUT", "onda", onda.id, escola_id=sol.escola_id,
                    dados={"solicitacao_id": sol.id, "numero": onda.numero})
    s.flush()
    disparar_proxima_onda(s, sol)
    return True


def solicitacoes_vencidas(s: Session, limite: int = 100) -> list[int]:
    """Solicitações em convocação cujo período já terminou (candidatas)."""
    agora_local = agora()
    sols = s.execute(
        select(Solicitacao).where(Solicitacao.status == StatusSolicitacao.EM_CONVOCACAO,
                                  Solicitacao.data_fim <= agora_local.date() + timedelta(days=1))
        .limit(limite * 5)
    ).scalars().all()
    return [x.id for x in sols if combinar(x.data_fim, x.hora_fim) <= agora_local][:limite]


def processar_expiracao(s: Session, solicitacao_id: int) -> bool:
    sol = travar_solicitacao(s, solicitacao_id, skip_locked=True)
    if sol is None:
        return False
    if sol.status != StatusSolicitacao.EM_CONVOCACAO or combinar(sol.data_fim, sol.hora_fim) > agora():
        return True
    pendentes = s.execute(
        select(Convocacao).where(Convocacao.solicitacao_id == sol.id,
                                 Convocacao.ciclo == sol.ciclo,
                                 Convocacao.status == StatusConvocacao.ENVIADA)
    ).scalars().all()
    for conv in pendentes:
        conv.status = StatusConvocacao.SEM_RESPOSTA
        notificacoes.solicitacao_encerrada(s, conv)
    s.flush()
    _encerrar(s, sol, StatusSolicitacao.EXPIRADA, configuracao.obter(s))
    notificacoes.diretor_expirada(s, sol)
    audit.registrar(s, "SOLICITACAO_EXPIRADA", "solicitacao", sol.id, escola_id=sol.escola_id)
    return True


# ------------------------------------------------------------------ cancelar / reabrir

def cancelar(s: Session, solicitacao_id: int, usuario: Usuario, motivo: str | None,
             ip: str | None = None) -> Solicitacao:
    sol = travar_solicitacao(s, solicitacao_id)
    if sol.status not in (StatusSolicitacao.EM_CONVOCACAO, StatusSolicitacao.PREENCHIDA,
                          StatusSolicitacao.ESGOTADA):
        raise ErroNegocio("Esta solicitação não pode ser cancelada no estado atual.")
    status_anterior = sol.status
    convs = s.execute(
        select(Convocacao).where(Convocacao.solicitacao_id == sol.id,
                                 Convocacao.ciclo == sol.ciclo,
                                 Convocacao.status.in_((StatusConvocacao.ENVIADA,
                                                        StatusConvocacao.ACEITA)))
    ).scalars().all()
    for conv in convs:
        aceita = conv.status == StatusConvocacao.ACEITA
        if not aceita:
            conv.status = StatusConvocacao.CANCELADA
        notificacoes.solicitacao_cancelada(s, conv, aceita=aceita)
    sol.motivo_cancelamento = (motivo or "").strip() or None
    _encerrar(s, sol, StatusSolicitacao.CANCELADA, configuracao.obter(s))
    audit.registrar(s, "SOLICITACAO_CANCELADA", "solicitacao", sol.id, ator_tipo="USUARIO",
                    ator_id=usuario.id, escola_id=sol.escola_id, ip=ip,
                    dados={"status_anterior": status_anterior.value, "motivo": sol.motivo_cancelamento,
                           "professor_aceito_id": sol.professor_aceito_id})
    return sol


def reabrir(s: Session, solicitacao_id: int, usuario: Usuario, ip: str | None = None
            ) -> Solicitacao:
    sol = travar_solicitacao(s, solicitacao_id)
    if sol.status not in (StatusSolicitacao.CANCELADA, StatusSolicitacao.ESGOTADA,
                          StatusSolicitacao.EXPIRADA):
        raise ErroNegocio("Só é possível reabrir solicitações canceladas, esgotadas ou expiradas.")
    if combinar(sol.data_fim, sol.hora_fim) <= agora():
        raise ErroNegocio("O período desta solicitação já terminou; crie uma nova.")
    lista = s.get(ListaClassificacao, sol.lista_id)
    if not lista.ativa:
        ativa = s.execute(select(ListaClassificacao).where(ListaClassificacao.ativa.is_(True))
                          ).scalar_one_or_none()
        if ativa is None:
            raise ErroNegocio("Não há lista de classificação ativa.")
        sol.lista_id = ativa.id
    status_anterior = sol.status
    sol.ciclo += 1
    sol.status = StatusSolicitacao.EM_CONVOCACAO
    sol.professor_aceito_id = None
    sol.preenchida_em = None
    sol.encerrada_em = None
    sol.motivo_cancelamento = None
    s.flush()
    audit.registrar(s, "SOLICITACAO_REABERTA", "solicitacao", sol.id, ator_tipo="USUARIO",
                    ator_id=usuario.id, escola_id=sol.escola_id, ip=ip,
                    dados={"status_anterior": status_anterior.value, "ciclo": sol.ciclo,
                           "lista_id": sol.lista_id})
    disparar_proxima_onda(s, sol)
    return sol
