from __future__ import annotations

import itertools
from datetime import timedelta

from sqlalchemy import select

from app import db as dbmod
from app.bot.handlers import processar_update
from app.models import Indisponibilidade, Professor, StatusSolicitacao
from app.security import sha256
from app.tempo import agora
from tests.conftest import Mundo, criar_solicitacao, gerar_cpf
from tests.helpers import conv_de, pulos, rodar_worker, sol

_ids = itertools.count(1)
CHAT = 555


def texto(msg, chat=CHAT):
    processar_update({"update_id": next(_ids), "message": {
        "message_id": next(_ids), "chat": {"id": chat, "type": "private"},
        "from": {"id": chat}, "text": msg}})


def clicar(data, chat=CHAT, message_id=77):
    processar_update({"update_id": next(_ids), "callback_query": {
        "id": f"cb{next(_ids)}", "from": {"id": chat}, "data": data,
        "message": {"message_id": message_id, "chat": {"id": chat}}}})


def _gerar_codigo(prof_id: int, codigo="123456"):
    with dbmod.transacao() as s:
        p = s.get(Professor, prof_id)
        p.codigo_vinculo_hash = sha256(f"{p.id}:{codigo}")
        p.codigo_vinculo_expira_em = agora() + timedelta(days=7)


def test_vinculo_cpf_codigo_e_consentimento(s, bot):
    m = Mundo(s, n_professores=0)
    p = m.add_prof(1, vinculado=False, consentimento=False)
    s.commit()
    _gerar_codigo(p.id)

    texto("/start")
    assert "CPF" in bot.enviadas[-1]["texto"]
    texto("123")
    assert "inválido" in bot.enviadas[-1]["texto"]
    texto(gerar_cpf(1))
    assert "código" in bot.enviadas[-1]["texto"]
    texto("123456")
    assert "Prof 01" in bot.enviadas[-2]["texto"]
    assert bot.enviadas[-1]["botoes"][0][0] == ("✅ Concordo", "lgpd:s")

    # sem consentimento ainda: comandos pedem o termo
    texto("/status")
    assert "Consentimento" in bot.enviadas[-1]["texto"]
    clicar("lgpd:s")
    with dbmod.transacao() as sx:
        prof = sx.get(Professor, p.id)
        assert prof.telegram_chat_id == CHAT and prof.tem_consentimento
        assert prof.codigo_vinculo_hash is None  # código de uso único

    # agora é elegível
    sid = criar_solicitacao(m)
    assert conv_de(sid, 1).professor_id == p.id


def test_codigo_errado_e_limite_de_tentativas(s, bot):
    m = Mundo(s, n_professores=0)
    p = m.add_prof(1, vinculado=False)
    s.commit()
    _gerar_codigo(p.id)
    for _ in range(5):
        texto(f"/vincular {gerar_cpf(1)} 000000")
    assert "incorreto" in bot.enviadas[-1]["texto"]
    texto(f"/vincular {gerar_cpf(1)} 123456")  # certo, mas bloqueado
    assert "Muitas tentativas" in bot.enviadas[-1]["texto"]
    with dbmod.transacao() as sx:
        assert sx.get(Professor, p.id).telegram_chat_id is None


def test_aceitar_pelo_botao(mundo, bot):
    sid = criar_solicitacao(mundo)
    rodar_worker()
    conv = conv_de(sid, 2)
    clicar(f"c:{conv.id}:a", chat=10_002)
    assert sol(sid).status == StatusSolicitacao.PREENCHIDA
    assert "confirmada" in bot.callbacks[-1]["texto"]
    # outro professor não pode responder pela convocação alheia
    clicar(f"c:{conv_de(sid, 1).id}:a", chat=10_003)
    assert "não encontrada" in bot.callbacks[-1]["texto"].lower()


def test_recusar_pelo_botao(mundo, bot):
    sid = criar_solicitacao(mundo)
    clicar(f"c:{conv_de(sid, 1).id}:r", chat=10_001)
    assert "Recusa registrada" in bot.callbacks[-1]["texto"]


def test_indisponibilidade_status_e_remocao(mundo, bot):
    chat = 10_001
    texto("/indisponivel 20/10 22/10 consulta médica", chat=chat)
    assert "registrada" in bot.enviadas[-1]["texto"]
    sid = criar_solicitacao(mundo)
    assert pulos(sid, onda=1) == [(1, "INDISPONIVEL")]

    texto("/status", chat=chat)
    st = bot.para(chat)[-1]
    assert "1º" in st["texto"] and "consulta médica" in st["texto"]
    with dbmod.transacao() as s:
        ind = s.execute(select(Indisponibilidade)).scalar_one()
    clicar(f"ind:x:{ind.id}", chat=chat)
    with dbmod.transacao() as s:
        assert s.execute(select(Indisponibilidade)).scalar_one_or_none() is None

    texto("/indisponivel 01/01/2020", chat=chat)
    assert "inválido" in bot.enviadas[-1]["texto"]


def test_minhas_e_sair(mundo, bot):
    sid = criar_solicitacao(mundo)
    clicar(f"c:{conv_de(sid, 1).id}:a", chat=10_001)
    texto("/minhas", chat=10_001)
    assert "EMEF A" in bot.enviadas[-1]["texto"]
    texto("/sair", chat=10_001)
    clicar("sair:s", chat=10_001)
    with dbmod.transacao() as s:
        p = s.get(Professor, mundo.prof(1).id)
        assert p.telegram_chat_id is None and not p.tem_consentimento
    sid2 = criar_solicitacao(mundo, turma="outra", data_inicio=mundo.dados_solicitacao()[
        "data_inicio"] + timedelta(days=1), data_fim=mundo.dados_solicitacao()["data_fim"]
        + timedelta(days=1))
    assert pulos(sid2, onda=1) == [(1, "SEM_VINCULO_BOT")]


def test_ignora_grupos(mundo, bot):
    processar_update({"update_id": 1, "message": {"chat": {"id": -1, "type": "group"},
                                                  "text": "/start"}})
    assert bot.enviadas == []
