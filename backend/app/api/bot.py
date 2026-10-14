from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from ..bot.handlers import processar_update
from ..config import get_settings
from ..security import iguais

router = APIRouter(prefix="/api/bot", tags=["bot"])
log = logging.getLogger("bot.webhook")


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request,
                           x_telegram_bot_api_secret_token: str | None = Header(None)):
    segredo = get_settings().telegram_webhook_secret
    if not segredo or not iguais(x_telegram_bot_api_secret_token or "", segredo):
        raise HTTPException(403, "Proibido")
    update = await request.json()
    try:
        await run_in_threadpool(processar_update, update)
    except Exception:
        # Erro (ex.: deadlock abortado pelo Postgres): devolve 500 para o
        # Telegram reenviar o update. As respostas são idempotentes.
        log.exception("falha ao processar update %s", update.get("update_id"))
        raise HTTPException(500, "erro")
    return {"ok": True}
