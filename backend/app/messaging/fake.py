"""Implementações em memória, usadas em desenvolvimento e nos testes."""
from __future__ import annotations

import itertools
import logging
import threading

from .base import Botoes, ErroEnvio

log = logging.getLogger("mensageria.fake")


class FakeMensageiro:
    def __init__(self):
        self.enviadas: list[dict] = []
        self.callbacks: list[dict] = []
        self.falhar_para: dict[int, ErroEnvio] = {}  # chat_id -> erro simulado
        self._ids = itertools.count(1000)
        self._lock = threading.Lock()

    def enviar(self, chat_id: int, texto: str, botoes: Botoes | None = None) -> int | None:
        if chat_id in self.falhar_para:
            raise self.falhar_para[chat_id]
        with self._lock:
            mid = next(self._ids)
            self.enviadas.append({"chat_id": chat_id, "texto": texto, "botoes": botoes,
                                  "message_id": mid})
        log.info("[telegram→%s] %s %s", chat_id, texto.replace("\n", " | "), botoes or "")
        return mid

    def remover_botoes(self, chat_id: int, message_id: int) -> None:
        pass

    def editar(self, chat_id: int, message_id: int, texto: str) -> None:
        log.info("[telegram edit %s/%s] %s", chat_id, message_id, texto)

    def responder_callback(self, callback_id: str, texto: str) -> None:
        self.callbacks.append({"id": callback_id, "texto": texto})

    def para(self, chat_id: int) -> list[dict]:
        return [m for m in self.enviadas if m["chat_id"] == chat_id]


class FakeEmail:
    def __init__(self):
        self.enviados: list[dict] = []

    def enviar(self, para: str, assunto: str, corpo: str) -> None:
        self.enviados.append({"para": para, "assunto": assunto, "corpo": corpo})
        log.info("[email→%s] %s", para, assunto)
