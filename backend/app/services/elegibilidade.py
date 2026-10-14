"""Montagem da fila de convocação e regras de elegibilidade.

A fila de uma solicitação é a lista de classificação filtrada pela habilitação
(etapa + disciplina) da vaga, em ordem efetiva:

    (rebaixado_em NULLS FIRST, rebaixado_em, posicao)

Cada professor da fila que ainda não foi convocado neste ciclo é avaliado em
ordem. Quem não está elegível é "pulado" com motivo (fica registrado em
`onda_pulo`), e os N primeiros elegíveis formam a onda.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, time

from sqlalchemy import and_, select
from sqlalchemy.orm import Session, contains_eager

from ..models import (
    Classificacao,
    Configuracao,
    Convocacao,
    Habilitacao,
    Indisponibilidade,
    MotivoPulo,
    Professor,
    Solicitacao,
    StatusConvocacao,
    StatusSolicitacao,
)
from ..tempo import dias_letivos, hoje, horas_entre


@dataclass
class Item:
    classificacao: Classificacao
    ordem: int  # posição efetiva na fila (1 = primeiro)

    @property
    def professor(self) -> Professor:
        return self.classificacao.professor


@dataclass
class Selecao:
    escolhidos: list[Item]
    pulos: list[tuple[Item, MotivoPulo]]


@dataclass
class _Ocupacao:
    """Substituição já aceita (ativa) de um professor."""

    solicitacao_id: int
    data_inicio: date
    data_fim: date
    hora_inicio: time
    hora_fim: time


def fila(s: Session, sol: Solicitacao) -> list[Item]:
    """Fila completa (habilitados), na ordem efetiva."""
    linhas = s.execute(
        select(Classificacao)
        .join(Classificacao.professor)
        .join(
            Habilitacao,
            and_(
                Habilitacao.professor_id == Professor.id,
                Habilitacao.etapa == sol.etapa,
                Habilitacao.disciplina_id == sol.disciplina_id,
            ),
        )
        .where(Classificacao.lista_id == sol.lista_id)
        .options(contains_eager(Classificacao.professor))
        .order_by(
            Classificacao.rebaixado_em.asc().nulls_first(),
            Classificacao.posicao.asc(),
        )
    ).scalars().unique().all()
    return [Item(c, i + 1) for i, c in enumerate(linhas)]


def _ocupacoes(s: Session, professor_ids: list[int], inicio: date, fim: date,
               excluir_solicitacao: int | None = None) -> dict[int, list[_Ocupacao]]:
    """Substituições aceitas (solicitação PREENCHIDA) que tocam o intervalo."""
    if not professor_ids:
        return {}
    q = (
        select(Convocacao.professor_id, Solicitacao)
        .join(Solicitacao, Solicitacao.id == Convocacao.solicitacao_id)
        .where(
            Convocacao.professor_id.in_(professor_ids),
            Convocacao.status == StatusConvocacao.ACEITA,
            Convocacao.ciclo == Solicitacao.ciclo,
            Solicitacao.status == StatusSolicitacao.PREENCHIDA,
            Solicitacao.data_inicio <= fim,
            Solicitacao.data_fim >= inicio,
        )
    )
    if excluir_solicitacao is not None:
        q = q.where(Solicitacao.id != excluir_solicitacao)
    res: dict[int, list[_Ocupacao]] = defaultdict(list)
    for pid, sol in s.execute(q).all():
        res[pid].append(_Ocupacao(sol.id, sol.data_inicio, sol.data_fim,
                                  sol.hora_inicio, sol.hora_fim))
    return res


def _indisponiveis(s: Session, professor_ids: list[int], dias: list[date]) -> set[int]:
    if not professor_ids or not dias:
        return set()
    linhas = s.execute(
        select(Indisponibilidade).where(
            Indisponibilidade.professor_id.in_(professor_ids),
            Indisponibilidade.data_inicio <= dias[-1],
            Indisponibilidade.data_fim >= dias[0],
        )
    ).scalars().all()
    res = set()
    for ind in linhas:
        if any(ind.data_inicio <= d <= ind.data_fim for d in dias):
            res.add(ind.professor_id)
    return res


def _horas_por_semana(dias: list[date], horas_dia: float) -> dict[tuple[int, int], float]:
    semanas: dict[tuple[int, int], float] = defaultdict(float)
    for d in dias:
        iso = d.isocalendar()
        semanas[(iso.year, iso.week)] += horas_dia
    return semanas


def motivo_conflito(sol: Solicitacao, cfg: Configuracao,
                    ocupacoes: list[_Ocupacao]) -> MotivoPulo | None:
    """Regras que dependem de outras substituições já aceitas pelo professor."""
    dias_novos = set(dias_letivos(sol.data_inicio, sol.data_fim))
    simultaneas = 0
    for oc in ocupacoes:
        dias_comuns = dias_novos & set(dias_letivos(oc.data_inicio, oc.data_fim))
        if not dias_comuns:
            continue
        simultaneas += 1
        if oc.hora_inicio < sol.hora_fim and sol.hora_inicio < oc.hora_fim:
            return MotivoPulo.CONFLITO_HORARIO
        if cfg.exclusividade_no_periodo:
            return MotivoPulo.SUBSTITUICAO_NO_PERIODO
    if cfg.max_substituicoes_simultaneas is not None and simultaneas >= cfg.max_substituicoes_simultaneas:
        return MotivoPulo.LIMITE_SIMULTANEAS
    if cfg.carga_horaria_max_semanal is not None:
        total = _horas_por_semana(sorted(dias_novos), horas_entre(sol.hora_inicio, sol.hora_fim))
        for oc in ocupacoes:
            extra = _horas_por_semana(dias_letivos(oc.data_inicio, oc.data_fim),
                                      horas_entre(oc.hora_inicio, oc.hora_fim))
            for semana in total:
                total[semana] += extra.get(semana, 0)
        if any(h > cfg.carga_horaria_max_semanal for h in total.values()):
            return MotivoPulo.CARGA_HORARIA
    return None


def motivo_cadastral(p: Professor) -> MotivoPulo | None:
    if not p.ativo:
        return MotivoPulo.INATIVO
    if p.telegram_chat_id is None:
        return MotivoPulo.SEM_VINCULO_BOT
    if not p.tem_consentimento:
        return MotivoPulo.SEM_CONSENTIMENTO
    if p.bot_bloqueado_em is not None:
        return MotivoPulo.BOT_BLOQUEADO
    if p.suspenso_ate is not None and p.suspenso_ate >= hoje():
        return MotivoPulo.SUSPENSO
    return None


def selecionar(s: Session, sol: Solicitacao, cfg: Configuracao, n: int) -> Selecao:
    """Os próximos `n` elegíveis da fila, mais os pulados à frente deles."""
    ja_convocados = set(
        s.execute(
            select(Convocacao.professor_id).where(
                Convocacao.solicitacao_id == sol.id, Convocacao.ciclo == sol.ciclo
            )
        ).scalars()
    )
    candidatos = [it for it in fila(s, sol) if it.professor.id not in ja_convocados]
    ids = [it.professor.id for it in candidatos]
    dias = dias_letivos(sol.data_inicio, sol.data_fim)
    indisponiveis = _indisponiveis(s, ids, dias)
    ocupacoes = _ocupacoes(s, ids, sol.data_inicio, sol.data_fim, excluir_solicitacao=sol.id)

    escolhidos: list[Item] = []
    pulos: list[tuple[Item, MotivoPulo]] = []
    for it in candidatos:
        if len(escolhidos) >= n:
            break
        p = it.professor
        motivo = motivo_cadastral(p)
        if motivo is None and p.id in indisponiveis:
            motivo = MotivoPulo.INDISPONIVEL
        if motivo is None:
            motivo = motivo_conflito(sol, cfg, ocupacoes.get(p.id, []))
        if motivo is None:
            escolhidos.append(it)
        else:
            pulos.append((it, motivo))
    return Selecao(escolhidos, pulos)


def conflito_no_aceite(s: Session, sol: Solicitacao, cfg: Configuracao,
                       professor_id: int) -> MotivoPulo | None:
    """Revalida, no momento do aceite (com o professor travado), as regras que
    dependem de outras substituições: o professor pode ter aceitado outra vaga
    depois de ter sido convocado para esta."""
    ocup = _ocupacoes(s, [professor_id], sol.data_inicio, sol.data_fim,
                      excluir_solicitacao=sol.id)
    return motivo_conflito(sol, cfg, ocup.get(professor_id, []))
