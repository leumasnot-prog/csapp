from __future__ import annotations

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app import audit
from app import db as dbmod
from app.models import LogAuditoria
from tests.conftest import criar_solicitacao
from tests.helpers import conv_de, responder


def test_eventos_do_fluxo_ficam_registrados(mundo):
    sid = criar_solicitacao(mundo)
    responder(conv_de(sid, 1).id, mundo.prof(1).id, aceitar=False)
    responder(conv_de(sid, 2).id, mundo.prof(2).id)
    with dbmod.transacao() as s:
        acoes = s.execute(select(LogAuditoria.acao).order_by(LogAuditoria.id)).scalars().all()
        onda = s.execute(select(LogAuditoria).where(LogAuditoria.acao == "ONDA_DISPARADA")
                         ).scalar_one()
    assert acoes == ["SOLICITACAO_CRIADA", "ONDA_DISPARADA", "RESPOSTA_RECUSA",
                     "VAGA_PREENCHIDA", "RESPOSTA_ACEITE"]
    assert [c["posicao"] for c in onda.dados["convocados"]] == [1, 2, 3]


def test_log_nao_pode_ser_alterado_nem_apagado(mundo):
    criar_solicitacao(mundo)
    for sql in ("UPDATE log_auditoria SET acao='X'", "DELETE FROM log_auditoria",
                "TRUNCATE log_auditoria"):
        with pytest.raises(DBAPIError, match="somente-inser"):
            with dbmod.transacao() as s:
                s.execute(text(sql))


def test_cadeia_de_hash_detecta_adulteracao(mundo):
    sid = criar_solicitacao(mundo)
    responder(conv_de(sid, 1).id, mundo.prof(1).id)
    with dbmod.transacao() as s:
        assert audit.verificar_cadeia(s)["ok"]
        alvo = s.execute(select(func.min(LogAuditoria.id))
                         .where(LogAuditoria.acao == "ONDA_DISPARADA")).scalar()
    # Simula um DBA mal-intencionado desligando os triggers
    with dbmod.engine().begin() as c:
        c.execute(text("SET session_replication_role = replica"))
        c.execute(text("UPDATE log_auditoria SET dados = '{}' WHERE id = :i"), {"i": alvo})
    with dbmod.transacao() as s:
        res = audit.verificar_cadeia(s)
    assert res == {"ok": False, "total": alvo - 1, "primeiro_erro_id": alvo}


def test_rollback_descarta_registros_pendentes(mundo):
    with pytest.raises(RuntimeError):
        with dbmod.transacao() as s:
            audit.registrar(s, "TESTE", "x", 1)
            raise RuntimeError
    with dbmod.transacao() as s:
        audit.registrar(s, "OUTRO", "x", 2)
    with dbmod.transacao() as s:
        assert s.execute(select(LogAuditoria.acao)).scalars().all() == ["OUTRO"]
