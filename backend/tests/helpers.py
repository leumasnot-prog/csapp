from __future__ import annotations

from sqlalchemy import select

from app import db as dbmod
from app import worker
from app.models import (
    Convocacao,
    Onda,
    OndaPulo,
    Solicitacao,
    StatusConvocacao,
    TipoResposta,
)
from app.services import motor


def responder(conv_id: int, prof_id: int, aceitar: bool = True):
    with dbmod.transacao() as s:
        return motor.responder(s, conv_id, prof_id,
                               TipoResposta.ACEITE if aceitar else TipoResposta.RECUSA)


def sol(sol_id: int) -> Solicitacao:
    with dbmod.transacao() as s:
        x = s.get(Solicitacao, sol_id)
        s.expunge(x)
        return x


def convs(sol_id: int, onda: int | None = None, ciclo: int | None = None) -> list[Convocacao]:
    with dbmod.transacao() as s:
        q = select(Convocacao).join(Onda).where(Convocacao.solicitacao_id == sol_id)
        if onda is not None:
            q = q.where(Onda.numero == onda)
        if ciclo is not None:
            q = q.where(Convocacao.ciclo == ciclo)
        res = s.execute(q.order_by(Convocacao.ciclo, Convocacao.ordem)).scalars().all()
        s.expunge_all()
        return list(res)


def posicoes(sol_id: int, onda: int, ciclo: int = 1) -> list[int]:
    return [c.posicao for c in convs(sol_id, onda, ciclo)]


def status_por_posicao(sol_id: int, ciclo: int = 1) -> dict[int, StatusConvocacao]:
    return {c.posicao: c.status for c in convs(sol_id, ciclo=ciclo)}


def pulos(sol_id: int, onda: int) -> list[tuple[int, str]]:
    with dbmod.transacao() as s:
        return [(p.posicao, p.motivo.value) for p in s.execute(
            select(OndaPulo).join(Onda).where(Onda.solicitacao_id == sol_id, Onda.numero == onda)
            .order_by(OndaPulo.ordem)).scalars()]


def conv_de(sol_id: int, posicao: int, ciclo: int = 1) -> Convocacao:
    return next(c for c in convs(sol_id, ciclo=ciclo) if c.posicao == posicao)


def rodar_worker() -> None:
    worker.executar_uma_vez()
