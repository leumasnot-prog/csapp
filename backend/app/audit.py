"""Log de auditoria imutável com encadeamento de hashes.

Cada registro guarda o hash do anterior, então qualquer alteração ou remoção
quebra a cadeia, e isso é detectado por `verificar_cadeia`. O trigger no
Postgres bloqueia UPDATE e DELETE.

Para a cadeia ser linear, as inserções são serializadas por um advisory lock.
Para não criar deadlock com os locks de linha do motor (solicitação, professor),
os registros ficam acumulados na sessão e só são gravados no `before_commit`.
Assim o advisory lock é sempre o ÚLTIMO lock que a transação pega.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import event, select, text
from sqlalchemy.orm import Session

from .models import LogAuditoria
from .tempo import agora

_LOCK_AUDITORIA = 7_301_202_601  # chave arbitrária do advisory lock
_PENDENTES = "auditoria_pendente"
GENESIS = "0" * 64


def _normalizar(dados: dict[str, Any] | None) -> dict[str, Any]:
    # Garante que o que é gravado no JSONB é exatamente o que será re-hasheado.
    return json.loads(json.dumps(dados or {}, default=str, ensure_ascii=False))


def _hash(anterior: str, ocorrido_em: datetime, ator_tipo: str, ator_id, acao: str,
          entidade: str, entidade_id, escola_id, dados: dict) -> str:
    corpo = json.dumps(
        {
            "anterior": anterior,
            "ocorrido_em": ocorrido_em.astimezone(timezone.utc).isoformat(timespec="microseconds"),
            "ator_tipo": ator_tipo,
            "ator_id": ator_id,
            "acao": acao,
            "entidade": entidade,
            "entidade_id": entidade_id,
            "escola_id": escola_id,
            "dados": dados,
        },
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(corpo.encode()).hexdigest()


def registrar(
    s: Session,
    acao: str,
    entidade: str,
    entidade_id: int | None = None,
    *,
    ator_tipo: str = "SISTEMA",
    ator_id: int | None = None,
    escola_id: int | None = None,
    dados: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    s.info.setdefault(_PENDENTES, []).append(
        dict(
            ocorrido_em=agora(),
            ator_tipo=ator_tipo,
            ator_id=ator_id,
            acao=acao,
            entidade=entidade,
            entidade_id=entidade_id,
            escola_id=escola_id,
            dados=_normalizar(dados),
            ip=ip,
        )
    )


@event.listens_for(Session, "before_commit")
def _gravar_pendentes(s: Session) -> None:
    pendentes = s.info.pop(_PENDENTES, None)
    if not pendentes:
        return
    s.flush()
    s.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LOCK_AUDITORIA})
    anterior = s.execute(
        select(LogAuditoria.hash).order_by(LogAuditoria.id.desc()).limit(1)
    ).scalar_one_or_none() or GENESIS
    for p in pendentes:
        h = _hash(anterior, p["ocorrido_em"], p["ator_tipo"], p["ator_id"], p["acao"],
                  p["entidade"], p["entidade_id"], p["escola_id"], p["dados"])
        s.add(LogAuditoria(hash_anterior=anterior, hash=h, **p))
        anterior = h
    s.flush()


@event.listens_for(Session, "after_rollback")
def _descartar_pendentes(s: Session) -> None:
    s.info.pop(_PENDENTES, None)


def verificar_cadeia(s: Session, lote: int = 5000) -> dict[str, Any]:
    """Recalcula toda a cadeia. Retorna {ok, total, primeiro_erro_id}."""
    anterior = GENESIS
    total = 0
    ultimo_id = 0
    while True:
        regs = s.execute(
            select(LogAuditoria).where(LogAuditoria.id > ultimo_id)
            .order_by(LogAuditoria.id).limit(lote)
        ).scalars().all()
        if not regs:
            break
        for r in regs:
            esperado = _hash(anterior, r.ocorrido_em, r.ator_tipo, r.ator_id, r.acao,
                             r.entidade, r.entidade_id, r.escola_id, r.dados)
            if r.hash_anterior != anterior or r.hash != esperado:
                return {"ok": False, "total": total, "primeiro_erro_id": r.id}
            anterior = r.hash
            total += 1
            ultimo_id = r.id
        s.expunge_all()
    return {"ok": True, "total": total, "primeiro_erro_id": None}
