"""Cliente mínimo da Telegram Bot API (sem dependências além do httpx)."""
from __future__ import annotations

import httpx

from .base import Botoes, ErroEnvio


class TelegramMensageiro:
    def __init__(self, token: str, timeout: float = 10.0):
        if not token:
            raise ValueError("SUBST_TELEGRAM_BOT_TOKEN não configurado")
        self._base = f"https://api.telegram.org/bot{token}"
        self._http = httpx.Client(timeout=timeout)

    def _chamar(self, metodo: str, dados: dict) -> dict:
        try:
            r = self._http.post(f"{self._base}/{metodo}", json=dados)
        except httpx.HTTPError as e:
            raise ErroEnvio(f"rede: {e.__class__.__name__}") from e
        try:
            corpo = r.json()
        except ValueError:
            corpo = {}
        if r.status_code == 200 and corpo.get("ok"):
            return corpo.get("result") or {}
        desc = corpo.get("description", r.text[:200])
        if r.status_code == 403:
            raise ErroEnvio(f"403 {desc}", bloqueado=True)
        if r.status_code == 429:
            retry = (corpo.get("parameters") or {}).get("retry_after", 5)
            raise ErroEnvio(f"429 {desc}", retry_after=float(retry))
        if 400 <= r.status_code < 500:
            raise ErroEnvio(f"{r.status_code} {desc}", permanente=True)
        raise ErroEnvio(f"{r.status_code} {desc}")

    @staticmethod
    def _teclado(botoes: Botoes | None) -> dict | None:
        if not botoes:
            return None
        return {"inline_keyboard": [[{"text": t, "callback_data": d} for t, d in linha]
                                    for linha in botoes]}

    def enviar(self, chat_id: int, texto: str, botoes: Botoes | None = None) -> int | None:
        dados = {"chat_id": chat_id, "text": texto, "parse_mode": "HTML",
                 "disable_web_page_preview": True}
        teclado = self._teclado(botoes)
        if teclado:
            dados["reply_markup"] = teclado
        return self._chamar("sendMessage", dados).get("message_id")

    def remover_botoes(self, chat_id: int, message_id: int) -> None:
        self._chamar("editMessageReplyMarkup", {"chat_id": chat_id, "message_id": message_id,
                                                "reply_markup": {"inline_keyboard": []}})

    def editar(self, chat_id: int, message_id: int, texto: str) -> None:
        self._chamar("editMessageText", {"chat_id": chat_id, "message_id": message_id,
                                         "text": texto, "parse_mode": "HTML"})

    def responder_callback(self, callback_id: str, texto: str) -> None:
        self._chamar("answerCallbackQuery", {"callback_query_id": callback_id,
                                             "text": texto[:190]})

    def configurar_webhook(self, url: str, segredo: str) -> dict:
        return self._chamar("setWebhook", {"url": url, "secret_token": segredo,
                                           "allowed_updates": ["message", "callback_query"]})

    def obter_updates(self, offset: int | None, timeout: int = 25) -> list[dict]:
        dados = {"timeout": timeout, "allowed_updates": ["message", "callback_query"]}
        if offset is not None:
            dados["offset"] = offset
        r = self._http.post(f"{self._base}/getUpdates", json=dados, timeout=timeout + 10)
        return r.json().get("result", [])
