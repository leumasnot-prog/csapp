"""Fábrica dos canais de saída (configuráveis por variável de ambiente)."""
from __future__ import annotations

from ..config import get_settings
from .base import EnviadorEmail, Mensageiro
from .fake import FakeEmail, FakeMensageiro

_mensageiro: Mensageiro | None = None
_email: EnviadorEmail | None = None


def mensageiro() -> Mensageiro:
    global _mensageiro
    if _mensageiro is None:
        cfg = get_settings()
        if cfg.mensageiro == "telegram":
            from .telegram import TelegramMensageiro

            _mensageiro = TelegramMensageiro(cfg.telegram_bot_token)
        else:
            _mensageiro = FakeMensageiro()
    return _mensageiro


def email() -> EnviadorEmail:
    global _email
    if _email is None:
        cfg = get_settings()
        if cfg.email_backend == "smtp":
            from .email import SmtpEmail

            _email = SmtpEmail(cfg.smtp_host, cfg.smtp_port, cfg.smtp_usuario, cfg.smtp_senha,
                               cfg.smtp_tls, cfg.email_remetente)
        else:
            _email = FakeEmail()
    return _email


def substituir(mensageiro_: Mensageiro | None = None, email_: EnviadorEmail | None = None) -> None:
    """Injeção para testes."""
    global _mensageiro, _email
    _mensageiro = mensageiro_
    _email = email_
