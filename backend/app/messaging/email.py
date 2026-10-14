from __future__ import annotations

import smtplib
from email.message import EmailMessage

from .base import ErroEnvio


class SmtpEmail:
    def __init__(self, host: str, porta: int, usuario: str, senha: str, tls: bool,
                 remetente: str):
        self.host, self.porta, self.usuario, self.senha = host, porta, usuario, senha
        self.tls, self.remetente = tls, remetente

    def enviar(self, para: str, assunto: str, corpo: str) -> None:
        msg = EmailMessage()
        msg["From"] = self.remetente
        msg["To"] = para
        msg["Subject"] = assunto
        msg.set_content(corpo)
        try:
            with smtplib.SMTP(self.host, self.porta, timeout=15) as smtp:
                if self.tls:
                    smtp.starttls()
                if self.usuario:
                    smtp.login(self.usuario, self.senha)
                smtp.send_message(msg)
        except smtplib.SMTPRecipientsRefused as e:
            raise ErroEnvio(f"destinatário recusado: {e}", permanente=True) from e
        except (smtplib.SMTPException, OSError) as e:
            raise ErroEnvio(f"smtp: {e}") from e
