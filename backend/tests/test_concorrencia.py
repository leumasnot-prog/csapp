"""Cenários de concorrência: o requisito central do sistema.

Cada thread usa a própria conexão e a própria transação, como acontece em
produção (webhooks do Telegram processados em paralelo + worker). Uma
`threading.Barrier` solta todas ao mesmo tempo. Os cenários são repetidos
várias vezes para aumentar a chance de pegar intercalações ruins.
"""
from __future__ import annotations

import threading
from collections import Counter
from datetime import time

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app import db as dbmod
from app.models import (
    Convocacao,
    OutboxMensagem,
    ResultadoResposta,
    StatusConvocacao,
    StatusSolicitacao,
    TipoResposta,
    Usuario,
)
from app.services import motor
from tests.conftest import Mundo, criar_solicitacao
from tests.helpers import conv_de, convs, rodar_worker, sol

REPETICOES = 15


def _em_paralelo(funcoes):
    """Roda as funções ao mesmo tempo; devolve resultados ou exceções."""
    barreira = threading.Barrier(len(funcoes))
    resultados = [None] * len(funcoes)

    def alvo(i, f):
        barreira.wait()
        try:
            resultados[i] = f()
        except Exception as e:  # noqa: BLE001
            resultados[i] = e

    threads = [threading.Thread(target=alvo, args=(i, f)) for i, f in enumerate(funcoes)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=60)
    return resultados


def _aceitar(conv_id, prof_id):
    def f():
        with dbmod.transacao() as s:
            return motor.responder(s, conv_id, prof_id, TipoResposta.ACEITE).resultado
    return f


def _assert_um_unico_aceite(sid):
    aceitas = [c for c in convs(sid) if c.status == StatusConvocacao.ACEITA]
    x = sol(sid)
    assert len(aceitas) == 1, [c.status for c in convs(sid)]
    assert x.status == StatusSolicitacao.PREENCHIDA
    assert x.professor_aceito_id == aceitas[0].professor_id
    return aceitas[0]


@pytest.mark.parametrize("rodada", range(REPETICOES))
def test_tres_aceites_simultaneos_apenas_um_vence(mundo, rodada):
    sid = criar_solicitacao(mundo)
    cs = convs(sid)
    res = _em_paralelo([_aceitar(c.id, c.professor_id) for c in cs])
    assert not any(isinstance(r, Exception) for r in res), res
    cont = Counter(res)
    assert cont[ResultadoResposta.VAGA_CONCEDIDA] == 1
    assert cont[ResultadoResposta.VAGA_JA_PREENCHIDA] == 2
    vencedor = _assert_um_unico_aceite(sid)
    perdedores = {c.status for c in convs(sid) if c.id != vencedor.id}
    assert perdedores == {StatusConvocacao.VAGA_PREENCHIDA}


def test_dez_aceites_simultaneos_onda_grande(s):
    m = Mundo(s, n_professores=10, tamanho_onda=10)
    for _ in range(5):
        sid = criar_solicitacao(m, turma=f"T{_}")
        res = _em_paralelo([_aceitar(c.id, c.professor_id) for c in convs(sid)])
        assert Counter(res)[ResultadoResposta.VAGA_CONCEDIDA] == 1, res
        _assert_um_unico_aceite(sid)
        # libera os professores para a próxima rodada (mesmo horário)
        with dbmod.transacao() as sx:
            motor.cancelar(sx, sid, sx.get(Usuario, m.diretor.id), None)


@pytest.mark.parametrize("rodada", range(REPETICOES))
def test_mesmo_professor_aceita_duas_vagas_conflitantes_ao_mesmo_tempo(mundo, rodada):
    """Duas escolas convocam o mesmo professor para o mesmo horário e ele
    aceita as duas quase ao mesmo tempo (ex.: dois celulares)."""
    sid1 = criar_solicitacao(mundo)
    with dbmod.transacao() as s:
        sid2 = motor.criar_solicitacao(s, s.get(Usuario, mundo.admin.id), **mundo.dados_solicitacao(
            escola_id=mundo.escola_b.id, hora_inicio=time(8), hora_fim=time(10))).id
    p1 = mundo.prof(1).id
    res = _em_paralelo([_aceitar(conv_de(sid1, 1).id, p1), _aceitar(conv_de(sid2, 1).id, p1)])
    assert sorted(r.value for r in res) == ["CONFLITO", "VAGA_CONCEDIDA"], res
    with dbmod.transacao() as s:
        aceitas = s.execute(select(func.count()).select_from(Convocacao).where(
            Convocacao.professor_id == p1, Convocacao.status == StatusConvocacao.ACEITA)).scalar()
    assert aceitas == 1


@pytest.mark.parametrize("rodada", range(REPETICOES))
def test_aceite_versus_cancelamento(mundo, rodada):
    sid = criar_solicitacao(mundo)
    c1 = conv_de(sid, 1)

    def cancelar():
        with dbmod.transacao() as s:
            motor.cancelar(s, sid, s.get(Usuario, mundo.diretor.id), None)
            return "CANCELADA"

    res = _em_paralelo([_aceitar(c1.id, c1.professor_id), cancelar])
    assert not any(isinstance(r, Exception) for r in res), res
    x = sol(sid)
    assert x.status == StatusSolicitacao.CANCELADA  # cancelar vale nos dois casos
    st = conv_de(sid, 1).status
    if res[0] == ResultadoResposta.VAGA_CONCEDIDA:
        # aceite veio antes: professor ficou com ACEITA e foi avisado do cancelamento
        assert st == StatusConvocacao.ACEITA
        rodar_worker()
    else:
        assert res[0] == ResultadoResposta.SOLICITACAO_ENCERRADA
        assert st == StatusConvocacao.CANCELADA


@pytest.mark.parametrize("rodada", range(REPETICOES))
def test_aceite_versus_timeout(mundo, relogio, rodada):
    """Professor aceita no exato momento em que o worker processa o timeout."""
    sid = criar_solicitacao(mundo)
    c1 = conv_de(sid, 1)
    relogio.avancar(minutes=15)

    def timeout():
        with dbmod.transacao() as s:
            # sem skip_locked aqui para forçar a disputa pelo lock
            for sol_id in motor.ondas_vencidas(s):
                motor.travar_solicitacao(s, sol_id)
                motor.processar_timeout(s, sol_id)
            return "TIMEOUT"

    res = _em_paralelo([_aceitar(c1.id, c1.professor_id), timeout])
    assert not any(isinstance(r, Exception) for r in res), res
    # aceite tardio é permitido: a vaga fica com o prof 1 em qualquer ordem
    assert res[0] == ResultadoResposta.VAGA_CONCEDIDA
    _assert_um_unico_aceite(sid)
    # se o timeout ganhou, a onda 2 foi disparada e encerrada como preenchida
    for c in convs(sid):
        assert c.status in (StatusConvocacao.ACEITA, StatusConvocacao.VAGA_PREENCHIDA,
                            StatusConvocacao.SEM_RESPOSTA)


@pytest.mark.parametrize("rodada", range(5))
def test_recusas_simultaneas_disparam_uma_unica_proxima_onda(mundo, rodada):
    sid = criar_solicitacao(mundo)

    def recusar(c):
        def f():
            with dbmod.transacao() as s:
                return motor.responder(s, c.id, c.professor_id, TipoResposta.RECUSA).resultado
        return f

    res = _em_paralelo([recusar(c) for c in convs(sid)])
    assert all(r == ResultadoResposta.RECUSA_REGISTRADA for r in res), res
    assert sorted(c.posicao for c in convs(sid, onda=2)) == [4, 5, 6]
    assert convs(sid, onda=3) == []


def test_workers_concorrentes_nao_duplicam_envio(mundo, bot):
    """Dois workers processando o outbox ao mesmo tempo (SKIP LOCKED)."""
    for i in range(5):
        criar_solicitacao(mundo, turma=f"T{i}", hora_inicio=time(7 + i), hora_fim=time(8 + i))
    from app import worker

    _em_paralelo([worker.processar_outbox, worker.processar_outbox, worker.processar_outbox])
    rodar_worker()
    with dbmod.transacao() as s:
        total = s.execute(select(func.count()).select_from(OutboxMensagem)).scalar()
    assert len(bot.enviadas) == total
    assert len({(m["chat_id"], m["texto"]) for m in bot.enviadas}) == total


def test_indice_unico_impede_dois_aceites_mesmo_sem_o_lock(mundo):
    """Defesa em profundidade: mesmo que um bug pulasse o lock, o banco recusa."""
    sid = criar_solicitacao(mundo)
    c1, c2 = conv_de(sid, 1), conv_de(sid, 2)
    with dbmod.transacao() as s:
        s.execute(text("UPDATE convocacao SET status='ACEITA' WHERE id=:i"), {"i": c1.id})
    with pytest.raises(IntegrityError):
        with dbmod.transacao() as s:
            s.execute(text("UPDATE convocacao SET status='ACEITA' WHERE id=:i"), {"i": c2.id})
