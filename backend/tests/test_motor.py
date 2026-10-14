"""Motor de ondas: fluxo normal e casos de borda (sem concorrência)."""
from __future__ import annotations

from datetime import date, time, timedelta

from sqlalchemy import select

from app import db as dbmod
from app.models import (
    Classificacao,
    Configuracao,
    Etapa,
    Indisponibilidade,
    MotivoFimOnda,
    Onda,
    Politica,
    Professor,
    Resposta,
    ResultadoResposta,
    StatusConvocacao,
    StatusSolicitacao,
    Usuario,
)
from app.services import motor
from tests.conftest import Mundo, criar_solicitacao
from tests.helpers import (
    conv_de,
    convs,
    posicoes,
    pulos,
    responder,
    rodar_worker,
    sol,
    status_por_posicao,
)

C = StatusConvocacao


def test_primeira_onda_convoca_os_3_primeiros(mundo, bot):
    sid = criar_solicitacao(mundo)
    assert posicoes(sid, onda=1) == [1, 2, 3]
    rodar_worker()
    destinatarios = sorted(m["chat_id"] for m in bot.enviadas)
    assert destinatarios == [10_001, 10_002, 10_003]
    msg = bot.enviadas[0]
    assert "EMEF A" in msg["texto"] and "20/10/2026" in msg["texto"]
    assert [b[0] for b in msg["botoes"][0]] == ["✅ Aceito", "❌ Recuso"]
    assert all(c.enviada_em is not None and c.telegram_message_id for c in convs(sid))


def test_primeiro_aceite_leva_a_vaga_e_os_outros_sao_avisados(mundo, bot):
    sid = criar_solicitacao(mundo)
    rodar_worker()
    r = responder(conv_de(sid, 2).id, mundo.prof(2).id)
    assert r.resultado == ResultadoResposta.VAGA_CONCEDIDA
    x = sol(sid)
    assert x.status == StatusSolicitacao.PREENCHIDA and x.professor_aceito_id == mundo.prof(2).id
    assert status_por_posicao(sid) == {1: C.VAGA_PREENCHIDA, 2: C.ACEITA, 3: C.VAGA_PREENCHIDA}

    # resposta tardia de quem perdeu
    r = responder(conv_de(sid, 1).id, mundo.prof(1).id)
    assert r.resultado == ResultadoResposta.VAGA_JA_PREENCHIDA

    rodar_worker()
    assert any("já foi preenchida" in m["texto"] for m in bot.para(10_001))
    assert any("já foi preenchida" in m["texto"] for m in bot.para(10_003))
    assert any("Vaga confirmada" in m["texto"] for m in bot.para(10_002))
    email = next(e for e in bot.emails.enviados if e["para"] == "dir.a@x.gov.br")
    assert "Prof 02" in email["corpo"] and "16999990002" in email["corpo"]


def test_todos_recusam_dispara_proxima_onda_sem_esperar(mundo):
    sid = criar_solicitacao(mundo)
    for pos in (1, 2, 3):
        responder(conv_de(sid, pos).id, mundo.prof(pos).id, aceitar=False)
    assert posicoes(sid, onda=2) == [4, 5, 6]
    with dbmod.transacao() as s:
        onda1 = s.execute(select(Onda).where(Onda.numero == 1)).scalar_one()
        assert onda1.motivo_encerramento == MotivoFimOnda.TODOS_RECUSARAM


def test_timeout_dispara_proxima_onda(mundo, relogio):
    sid = criar_solicitacao(mundo)
    responder(conv_de(sid, 1).id, mundo.prof(1).id, aceitar=False)
    relogio.avancar(minutes=14)
    rodar_worker()
    assert convs(sid, onda=2) == []
    relogio.avancar(minutes=2)
    rodar_worker()
    assert posicoes(sid, onda=2) == [4, 5, 6]
    assert status_por_posicao(sid)[1] == C.RECUSADA
    assert status_por_posicao(sid)[2] == C.SEM_RESPOSTA


def test_aceite_tardio_vale_enquanto_a_vaga_esta_aberta(mundo, relogio):
    sid = criar_solicitacao(mundo)
    relogio.avancar(minutes=16)
    rodar_worker()  # onda 2 sai
    r = responder(conv_de(sid, 1).id, mundo.prof(1).id)
    assert r.resultado == ResultadoResposta.VAGA_CONCEDIDA
    st = status_por_posicao(sid)
    assert st[1] == C.ACEITA and st[2] == C.SEM_RESPOSTA
    assert st[4] == st[5] == st[6] == C.VAGA_PREENCHIDA


def test_aceite_tardio_bloqueado_por_configuracao(s, relogio):
    m = Mundo(s, aceitar_resposta_tardia=False)
    sid = criar_solicitacao(m)
    relogio.avancar(minutes=16)
    rodar_worker()
    r = responder(conv_de(sid, 1).id, m.prof(1).id)
    assert r.resultado == ResultadoResposta.PRAZO_ENCERRADO
    assert sol(sid).status == StatusSolicitacao.EM_CONVOCACAO


def test_urgente_usa_timeout_menor(mundo, relogio):
    sid = criar_solicitacao(mundo, urgente=True)
    assert sol(sid).timeout_minutos == 5
    relogio.avancar(minutes=6)
    rodar_worker()
    assert posicoes(sid, onda=2) == [4, 5, 6]


def test_fila_esgotada_alerta_diretor_e_secretaria(s, bot):
    m = Mundo(s, n_professores=4)
    sid = criar_solicitacao(m)
    for pos in (1, 2, 3):
        responder(conv_de(sid, pos).id, m.prof(pos).id, aceitar=False)
    assert posicoes(sid, onda=2) == [4]
    responder(conv_de(sid, 4).id, m.prof(4).id, aceitar=False)
    assert sol(sid).status == StatusSolicitacao.ESGOTADA
    rodar_worker()
    destinos = {e["para"] for e in bot.emails.enviados if "fila esgotada" in e["assunto"]}
    assert destinos == {"dir.a@x.gov.br", "admin@x.gov.br"}


def test_filtra_habilitacao_e_registra_pulos_com_motivo(s):
    m = Mundo(s, n_professores=0)
    m.add_prof(1, etapa=Etapa.EF2, disc=m.mat)  # não habilitado: fora da fila
    m.add_prof(2, vinculado=False)  # sem bot
    m.add_prof(3, consentimento=False)
    p4 = m.add_prof(4)
    p5 = m.add_prof(5)
    m.add_prof(6)
    m.add_prof(7)
    m.add_prof(8)
    s.add(Indisponibilidade(professor_id=p4.id, data_inicio=date(2026, 10, 19),
                            data_fim=date(2026, 10, 23)))
    s.get(Professor, p5.id).suspenso_ate = date(2026, 10, 30)
    s.commit()
    sid = criar_solicitacao(m)
    assert posicoes(sid, onda=1) == [6, 7, 8]
    assert pulos(sid, onda=1) == [(2, "SEM_VINCULO_BOT"), (3, "SEM_CONSENTIMENTO"),
                                  (4, "INDISPONIVEL"), (5, "SUSPENSO")]


def test_conflito_de_horario_com_substituicao_aceita(mundo):
    sid1 = criar_solicitacao(mundo)
    responder(conv_de(sid1, 1).id, mundo.prof(1).id)
    # mesma data, horário sobreposto, outra escola
    with dbmod.transacao() as s:
        u = s.get(Usuario, mundo.admin.id)
        sid2 = motor.criar_solicitacao(s, u, **mundo.dados_solicitacao(
            escola_id=mundo.escola_b.id, hora_inicio=time(10, 0), hora_fim=time(12, 0))).id
    assert posicoes(sid2, onda=1) == [2, 3, 4]
    assert pulos(sid2, onda=1) == [(1, "CONFLITO_HORARIO")]
    # à tarde não conflita
    sid3 = criar_solicitacao(mundo, turno="TARDE", hora_inicio=time(13, 0), hora_fim=time(17, 0))
    assert posicoes(sid3, onda=1) == [1, 2, 3]


def test_aceite_com_conflito_surgido_depois_da_convocacao(mundo):
    """Professor convocado para duas vagas no mesmo horário aceita as duas:
    a segunda é recusada como CONFLITO e a onda segue."""
    sid1 = criar_solicitacao(mundo)
    sid2 = criar_solicitacao(mundo, turma="4º B")
    assert posicoes(sid1, 1) == posicoes(sid2, 1) == [1, 2, 3]
    responder(conv_de(sid1, 1).id, mundo.prof(1).id)
    r = responder(conv_de(sid2, 1).id, mundo.prof(1).id)
    assert r.resultado == ResultadoResposta.CONFLITO
    assert status_por_posicao(sid2)[1] == C.INELEGIVEL
    assert sol(sid2).status == StatusSolicitacao.EM_CONVOCACAO


def test_cancelamento_no_meio_do_processo(mundo, bot):
    sid = criar_solicitacao(mundo)
    rodar_worker()
    responder(conv_de(sid, 1).id, mundo.prof(1).id, aceitar=False)
    with dbmod.transacao() as s:
        motor.cancelar(s, sid, s.get(Usuario, mundo.diretor.id), "professor titular voltou")
    assert sol(sid).status == StatusSolicitacao.CANCELADA
    assert status_por_posicao(sid) == {1: C.RECUSADA, 2: C.CANCELADA, 3: C.CANCELADA}
    r = responder(conv_de(sid, 2).id, mundo.prof(2).id)
    assert r.resultado == ResultadoResposta.SOLICITACAO_ENCERRADA
    rodar_worker()
    assert any("cancelada pela escola" in m["texto"] for m in bot.para(10_002))
    assert not any("cancelada" in m["texto"] for m in bot.para(10_001))  # já tinha recusado


def test_cancelar_vaga_preenchida_avisa_o_professor_e_libera_a_agenda(mundo, bot):
    sid = criar_solicitacao(mundo)
    rodar_worker()
    responder(conv_de(sid, 1).id, mundo.prof(1).id)
    with dbmod.transacao() as s:
        motor.cancelar(s, sid, s.get(Usuario, mundo.diretor.id), None)
    rodar_worker()
    assert any("havia aceitado foi" in m["texto"] for m in bot.para(10_001))
    sid2 = criar_solicitacao(mundo)  # mesmo horário: prof 1 está livre de novo
    assert posicoes(sid2, onda=1) == [1, 2, 3]


def test_reabrir_comeca_novo_ciclo_do_topo(s):
    m = Mundo(s, n_professores=3)
    sid = criar_solicitacao(m)
    for pos in (1, 2, 3):
        responder(conv_de(sid, pos).id, m.prof(pos).id, aceitar=False)
    assert sol(sid).status == StatusSolicitacao.ESGOTADA
    with dbmod.transacao() as sx:
        motor.reabrir(sx, sid, sx.get(Usuario, m.diretor.id))
    x = sol(sid)
    assert x.status == StatusSolicitacao.EM_CONVOCACAO and x.ciclo == 2
    assert [c.posicao for c in convs(sid, ciclo=2)] == [1, 2, 3]
    # botão antigo (ciclo 1) não vale mais
    r = responder(conv_de(sid, 1, ciclo=1).id, m.prof(1).id)
    assert r.resultado in (ResultadoResposta.JA_RESPONDIDA, ResultadoResposta.SOLICITACAO_ENCERRADA)
    assert responder(conv_de(sid, 1, ciclo=2).id, m.prof(1).id).resultado == \
        ResultadoResposta.VAGA_CONCEDIDA


def test_nao_reabre_preenchida(mundo):
    sid = criar_solicitacao(mundo)
    responder(conv_de(sid, 1).id, mundo.prof(1).id)
    with dbmod.transacao() as s:
        try:
            motor.reabrir(s, sid, s.get(Usuario, mundo.diretor.id))
            raise AssertionError("deveria falhar")
        except motor.ErroNegocio:
            pass


def test_penalidade_recusa_fim_da_lista(s):
    m = Mundo(s, politica_recusa=Politica.FIM_DA_LISTA)
    sid = criar_solicitacao(m)
    responder(conv_de(sid, 1).id, m.prof(1).id, aceitar=False)
    with dbmod.transacao() as sx:
        c = sx.execute(select(Classificacao).where(Classificacao.professor_id == m.prof(1).id)
                       ).scalar_one()
        assert c.rebaixado_em is not None and c.posicao == 1  # posição oficial intacta
    sid2 = criar_solicitacao(m, turma="outra")
    assert posicoes(sid2, onda=1) == [2, 3, 4]
    assert conv_de(sid2, 2).ordem == 1


def test_penalidade_recusa_suspensao(s, relogio):
    m = Mundo(s, politica_recusa=Politica.SUSPENDER, dias_suspensao_recusa=7)
    sid = criar_solicitacao(m)
    responder(conv_de(sid, 1).id, m.prof(1).id, aceitar=False)
    sid2 = criar_solicitacao(m, turma="outra")
    assert pulos(sid2, onda=1) == [(1, "SUSPENSO")]
    relogio.avancar(days=8)
    sid3 = criar_solicitacao(m, data_inicio=date(2026, 10, 28), data_fim=date(2026, 10, 28))
    assert posicoes(sid3, onda=1) == [1, 2, 3]


def test_sem_resposta_penalizado_so_no_encerramento_e_nao_no_cancelamento(s, relogio):
    m = Mundo(s, politica_sem_resposta=Politica.SUSPENDER, dias_suspensao_sem_resposta=3)
    sid = criar_solicitacao(m)
    relogio.avancar(minutes=16)
    rodar_worker()
    with dbmod.transacao() as sx:
        assert sx.get(Professor, m.prof(1).id).suspenso_ate is None  # ainda pode aceitar tarde
    responder(conv_de(sid, 4).id, m.prof(4).id)
    with dbmod.transacao() as sx:
        for pos in (1, 2, 3):
            assert sx.get(Professor, m.prof(pos).id).suspenso_ate == date(2026, 10, 22)
        # 5 e 6 receberam "vaga preenchida" antes do prazo: sem penalidade
        assert sx.get(Professor, m.prof(5).id).suspenso_ate is None

    sid2 = criar_solicitacao(m, data_inicio=date(2026, 10, 27), data_fim=date(2026, 10, 27))
    relogio.avancar(minutes=16)
    rodar_worker()
    with dbmod.transacao() as sx:
        motor.cancelar(sx, sid2, sx.get(Usuario, m.diretor.id), None)
    nao_responderam = [c.professor_id for c in convs(sid2, onda=1)]
    with dbmod.transacao() as sx:
        assert all(sx.get(Professor, pid).suspenso_ate is None for pid in nao_responderam)


def test_expira_quando_o_periodo_termina(mundo, relogio, bot):
    sid = criar_solicitacao(mundo, data_inicio=date(2026, 10, 19), data_fim=date(2026, 10, 19),
                            hora_inicio=time(13, 0), hora_fim=time(17, 0))
    relogio.avancar(hours=7, minutes=1)  # 17:01
    rodar_worker()
    assert sol(sid).status == StatusSolicitacao.EXPIRADA
    assert any("expirada" in e["assunto"] for e in bot.emails.enviados)


def test_falha_de_envio_permanente_avanca_a_onda(mundo, bot):
    from app.messaging.base import ErroEnvio

    for chat in (10_001, 10_002, 10_003):
        bot.falhar_para[chat] = ErroEnvio("403 blocked", bloqueado=True)
    sid = criar_solicitacao(mundo)
    rodar_worker()
    assert status_por_posicao(sid)[1] == C.FALHA_ENVIO
    assert posicoes(sid, onda=2) == [4, 5, 6]
    with dbmod.transacao() as s:
        assert s.get(Professor, mundo.prof(1).id).bot_bloqueado_em is not None
    sid2 = criar_solicitacao(mundo, turma="outra")
    assert [p for p, _ in pulos(sid2, onda=1)] == [1, 2, 3]


def test_falha_temporaria_tem_retry_com_backoff(mundo, bot, relogio):
    from app.messaging.base import ErroEnvio
    from app.models import OutboxMensagem, StatusOutbox

    bot.falhar_para[10_001] = ErroEnvio("502")
    criar_solicitacao(mundo)
    rodar_worker()
    with dbmod.transacao() as s:
        m = s.execute(select(OutboxMensagem).where(OutboxMensagem.destino == "10001")).scalar_one()
        assert m.status == StatusOutbox.PENDENTE and m.tentativas == 1
    del bot.falhar_para[10_001]
    rodar_worker()
    assert bot.para(10_001) == []  # ainda em backoff
    relogio.avancar(seconds=6)
    rodar_worker()
    assert len(bot.para(10_001)) == 1


def test_mensagem_de_convocacao_obsoleta_e_descartada(mundo, bot):
    """Se a vaga foi preenchida antes de o worker enviar, ninguém recebe
    convocação nem aviso de encerramento."""
    sid = criar_solicitacao(mundo)
    responder(conv_de(sid, 1).id, mundo.prof(1).id)
    rodar_worker()
    assert bot.para(10_002) == [] and bot.para(10_003) == []


def test_limite_de_carga_horaria_semanal(s):
    m = Mundo(s, carga_horaria_max_semanal=25)
    # manhãs de seg a sex: 4,5h x 5 = 22,5h
    sid1 = criar_solicitacao(m, data_inicio=date(2026, 10, 19), data_fim=date(2026, 10, 23))
    responder(conv_de(sid1, 1).id, m.prof(1).id)
    # +4h na mesma semana = 26,5h > 25h
    sid2 = criar_solicitacao(m, turno="TARDE", hora_inicio=time(13), hora_fim=time(17))
    assert pulos(sid2, onda=1) == [(1, "CARGA_HORARIA")]
    # semana seguinte: ok
    sid3 = criar_solicitacao(m, turno="TARDE", hora_inicio=time(13), hora_fim=time(17),
                             data_inicio=date(2026, 10, 26), data_fim=date(2026, 10, 26))
    assert posicoes(sid3, onda=1) == [1, 2, 3]


def test_limite_de_substituicoes_simultaneas(s):
    m = Mundo(s, max_substituicoes_simultaneas=1)
    sid1 = criar_solicitacao(m)
    responder(conv_de(sid1, 1).id, m.prof(1).id)
    sid2 = criar_solicitacao(m, turno="TARDE", hora_inicio=time(13), hora_fim=time(17))
    assert pulos(sid2, onda=1) == [(1, "LIMITE_SIMULTANEAS")]


def test_resposta_repetida_e_idempotente(mundo):
    sid = criar_solicitacao(mundo)
    responder(conv_de(sid, 1).id, mundo.prof(1).id)
    r = responder(conv_de(sid, 1).id, mundo.prof(1).id)
    assert r.resultado == ResultadoResposta.JA_RESPONDIDA
    with dbmod.transacao() as s:
        assert len(s.execute(select(Resposta)).scalars().all()) == 2  # ambas registradas


def test_professor_nao_responde_convocacao_alheia(mundo):
    sid = criar_solicitacao(mundo)
    try:
        responder(conv_de(sid, 1).id, mundo.prof(2).id)
        raise AssertionError("deveria falhar")
    except motor.ErroNegocio:
        pass


def test_tamanho_de_onda_configuravel(s):
    m = Mundo(s, tamanho_onda=5)
    sid = criar_solicitacao(m)
    assert posicoes(sid, onda=1) == [1, 2, 3, 4, 5]


def test_dados_invalidos(mundo):
    for kw in (dict(data_fim=date(2026, 10, 19), data_inicio=date(2026, 10, 20)),
               dict(hora_inicio=time(12), hora_fim=time(11)),
               dict(data_inicio=date(2026, 10, 1), data_fim=date(2026, 10, 1))):
        try:
            criar_solicitacao(mundo, **kw)
            raise AssertionError(kw)
        except motor.ErroNegocio:
            pass


def test_configuracao_padrao(s):
    from app.services import configuracao

    cfg = configuracao.obter(s)
    assert (cfg.tamanho_onda, cfg.timeout_minutos, cfg.politica_recusa) == (3, 15, Politica.MANTER)
    assert isinstance(cfg, Configuracao)
    assert timedelta(minutes=cfg.timeout_minutos_urgente) == timedelta(minutes=5)
