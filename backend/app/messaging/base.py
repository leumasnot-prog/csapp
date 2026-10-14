from __future__ import annotations

from typing import Protocol

Botoes = list[list[tuple[str, str]]]  # linhas de (texto, callback_data)


class ErroEnvio(Exception):
    """Falha de envio. `permanente=True` não deve ser repetida."""

    def __init__(self, msg: str, *, permanente: bool = False, bloqueado: bool = False,
                 retry_after: float | None = None):
        super().__init__(msg)
        self.permanente = permanente or bloqueado
        self.bloqueado = bloqueado  # destinatário bloqueou o bot
        self.retry_after = retry_after


class Mensageiro(Protocol):
    def enviar(self, chat_id: int, texto: str, botoes: Botoes | None = None) -> int | None:
        """Envia e devolve o message_id."""

    def remover_botoes(self, chat_id: int, message_id: int) -> None: ...

    def editar(self, chat_id: int, message_id: int, texto: str) -> None: ...

    def responder_callback(self, callback_id: str, texto: str) -> None: ...


class EnviadorEmail(Protocol):
    def enviar(self, para: str, assunto: str, corpo: str) -> None: ...
