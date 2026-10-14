"""Worker: envia o outbox (com retry) e processa timeouts de onda e expirações.

Pode rodar mais de uma instância: o outbox usa `FOR UPDATE SKIP LOCKED` e os
timers travam a solicitação com SKIP LOCKED.

    python -m app.worker
"""
from __future__ import annotations

import logging
import signal
import time
from datetime import timedelta

from sqlalchemy import select

from . import audit, messaging
from .config import get_settings
from .db import transacao
from .messaging.base import ErroEnvio
from .models import (
    CONVOCACAO_ABERTA,
    Canal,
    Convocacao,
    OutboxMensagem,
    Professor,
    StatusOutbox,
    StatusSolicitacao,
)
from .services import motor
from .tempo import agora

log = logging.getLogger("worker")

TIPOS_POS_CONVOCACAO = {"VAGA_PREENCHIDA", "CANCELAMENTO", "ENCERRAMENTO"}


def _backoff(tentativas: int) -> timedelta:
    return timedelta(seconds=min(5 * 2 ** (tentativas - 1), 15 * 60))


def _obsoleta(s, m: OutboxMensagem) -> bool:
    """Mensagens que não fazem mais sentido quando chega a vez delas."""
    if m.convocacao_id is None:
        return False
    conv = s.get(Convocacao, m.convocacao_id)
    if m.tipo == "CONVOCACAO":
        return not (conv.status in CONVOCACAO_ABERTA
                    and conv.solicitacao.status == StatusSolicitacao.EM_CONVOCACAO
                    and conv.ciclo == conv.solicitacao.ciclo)
    return False


def _enviar(s, m: OutboxMensagem) -> None:
    if m.canal == Canal.EMAIL:
        messaging.email().enviar(m.destino, m.payload["assunto"], m.payload["corpo"])
        return
    bot = messaging.mensageiro()
    chat_id = int(m.destino)
    remover_de = m.payload.get("remover_botoes_de")
    if remover_de:
        conv = s.get(Convocacao, remover_de)
        if conv is not None and conv.telegram_message_id:
            try:
                bot.remover_botoes(chat_id, conv.telegram_message_id)
            except ErroEnvio:
                pass  # cosmético
    botoes = m.payload.get("botoes")
    botoes = [[tuple(b) for b in linha] for linha in botoes] if botoes else None
    message_id = bot.enviar(chat_id, m.payload["texto"], botoes)
    if m.tipo == "CONVOCACAO" and m.convocacao_id:
        conv = s.get(Convocacao, m.convocacao_id)
        conv.enviada_em = agora()
        conv.telegram_message_id = message_id


def processar_outbox(lote: int = 20) -> int:
    max_tentativas = get_settings().outbox_max_tentativas
    falhas_convocacao: list[tuple[int, str]] = []
    with transacao() as s:
        msgs = s.execute(
            select(OutboxMensagem)
            .where(OutboxMensagem.status == StatusOutbox.PENDENTE,
                   OutboxMensagem.proxima_tentativa_em <= agora())
            .order_by(OutboxMensagem.id).limit(lote)
            .with_for_update(skip_locked=True)
        ).scalars().all()
        for m in msgs:
            if _obsoleta(s, m):
                m.status = StatusOutbox.DESCARTADA
                continue
            if m.tipo in TIPOS_POS_CONVOCACAO and m.payload.get("remover_botoes_de"):
                conv = s.get(Convocacao, m.payload["remover_botoes_de"])
                if conv is not None and conv.enviada_em is None:
                    # A convocação nunca chegou; não faz sentido avisar do encerramento.
                    m.status = StatusOutbox.DESCARTADA
                    continue
            m.tentativas += 1
            try:
                _enviar(s, m)
            except ErroEnvio as e:
                m.ultimo_erro = str(e)[:1000]
                if e.bloqueado and m.professor_id:
                    prof = s.get(Professor, m.professor_id)
                    if prof.bot_bloqueado_em is None:
                        prof.bot_bloqueado_em = agora()
                        audit.registrar(s, "BOT_BLOQUEADO", "professor", prof.id,
                                        dados={"erro": str(e)[:200]})
                if e.permanente or m.tentativas >= max_tentativas:
                    m.status = StatusOutbox.FALHA
                    if m.tipo == "CONVOCACAO" and m.convocacao_id:
                        falhas_convocacao.append((m.convocacao_id, str(e)))
                    log.warning("outbox %s falhou definitivamente: %s", m.id, e)
                else:
                    espera = _backoff(m.tentativas)
                    if e.retry_after:
                        espera = max(espera, timedelta(seconds=e.retry_after))
                    m.proxima_tentativa_em = agora() + espera
                    log.info("outbox %s: tentativa %s falhou (%s); nova em %s", m.id,
                             m.tentativas, e, espera)
            except Exception as e:  # erro inesperado: trata como temporário
                log.exception("outbox %s: erro inesperado", m.id)
                m.ultimo_erro = repr(e)[:1000]
                if m.tentativas >= max_tentativas:
                    m.status = StatusOutbox.FALHA
                else:
                    m.proxima_tentativa_em = agora() + _backoff(m.tentativas)
            else:
                m.status = StatusOutbox.ENVIADA
                m.enviada_em = agora()
                m.ultimo_erro = None
        n = len(msgs)
    # Fora da transação do outbox: o motor trava a solicitação.
    for conv_id, erro in falhas_convocacao:
        try:
            with transacao() as s:
                motor.falha_envio(s, conv_id, erro)
        except Exception:
            log.exception("falha_envio(%s)", conv_id)
    return n


def processar_timers() -> int:
    feitos = 0
    with transacao() as s:
        ondas = motor.ondas_vencidas(s)
        expiradas = motor.solicitacoes_vencidas(s)
    for sol_id in expiradas:
        try:
            with transacao() as s:
                feitos += motor.processar_expiracao(s, sol_id)
        except Exception:
            log.exception("expiração da solicitação %s", sol_id)
    for sol_id in ondas:
        try:
            with transacao() as s:
                feitos += motor.processar_timeout(s, sol_id)
        except Exception:
            log.exception("timeout da solicitação %s", sol_id)
    return feitos


def executar_uma_vez() -> None:
    processar_timers()
    while processar_outbox() > 0:
        pass


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    intervalo = get_settings().worker_intervalo_segundos
    parar = False

    def _sinal(*_):
        nonlocal parar
        parar = True

    signal.signal(signal.SIGTERM, _sinal)
    signal.signal(signal.SIGINT, _sinal)
    log.info("worker iniciado (intervalo %.1fs)", intervalo)
    while not parar:
        try:
            executar_uma_vez()
        except Exception:
            log.exception("erro no ciclo do worker")
        time.sleep(intervalo)
    log.info("worker encerrado")


if __name__ == "__main__":
    main()
