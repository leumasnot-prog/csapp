"""Comandos administrativos.

    python -m app.cli init-db
    python -m app.cli criar-admin --nome "Fulana" --email adm@pref.gov.br [--senha ...]
    python -m app.cli demo [--simular-vinculo]   # dados de exemplo (desenvolvimento)
    python -m app.cli webhook https://dominio/api/bot/telegram/webhook
    python -m app.cli bot-polling         # bot sem webhook (desenvolvimento)
"""
from __future__ import annotations

import argparse
import getpass
import logging
import sys

from sqlalchemy import select

from . import audit
from .config import get_settings
from .db import criar_esquema, transacao
from .models import Perfil, Usuario
from .security import hash_senha


def init_db(_args) -> None:
    criar_esquema()
    print("Esquema criado/atualizado.")


def criar_admin(args) -> None:
    senha = args.senha or getpass.getpass("Senha (mín. 8): ")
    if len(senha) < 8:
        sys.exit("Senha muito curta.")
    with transacao() as s:
        if s.execute(select(Usuario).where(Usuario.email == args.email.lower())).scalar():
            sys.exit("E-mail já cadastrado.")
        u = Usuario(nome=args.nome, email=args.email.lower(), senha_hash=hash_senha(senha),
                    perfil=Perfil.ADMIN)
        s.add(u)
        s.flush()
        audit.registrar(s, "USUARIO_CRIADO", "usuario", u.id, dados={"perfil": "admin", "via": "cli"})
    print(f"Admin {args.email} criado.")


def demo(args) -> None:
    from .demo import popular, simular_vinculo

    popular()
    if args.simular_vinculo:
        simular_vinculo()


def webhook(args) -> None:
    from .messaging.telegram import TelegramMensageiro

    cfg = get_settings()
    if not cfg.telegram_webhook_secret:
        sys.exit("Defina SUBST_TELEGRAM_WEBHOOK_SECRET.")
    print(TelegramMensageiro(cfg.telegram_bot_token).configurar_webhook(
        args.url, cfg.telegram_webhook_secret))


def bot_polling(_args) -> None:
    """Modo desenvolvimento: busca updates (long polling) em vez de webhook."""
    from .bot.handlers import processar_update
    from .messaging.telegram import TelegramMensageiro

    logging.basicConfig(level=logging.INFO)
    tg = TelegramMensageiro(get_settings().telegram_bot_token)
    tg._chamar("deleteWebhook", {})
    offset = None
    print("Bot em long polling. Ctrl+C para sair.")
    while True:
        for upd in tg.obter_updates(offset):
            offset = upd["update_id"] + 1
            try:
                processar_update(upd)
            except Exception:
                logging.exception("update %s", upd.get("update_id"))


def main() -> None:
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(required=True)
    sub.add_parser("init-db").set_defaults(f=init_db)
    a = sub.add_parser("criar-admin")
    a.add_argument("--nome", required=True)
    a.add_argument("--email", required=True)
    a.add_argument("--senha")
    a.set_defaults(f=criar_admin)
    d = sub.add_parser("demo")
    d.add_argument("--simular-vinculo", action="store_true",
                   help="marca todos os professores como vinculados ao bot (só dev)")
    d.set_defaults(f=demo)
    w = sub.add_parser("webhook")
    w.add_argument("url")
    w.set_defaults(f=webhook)
    sub.add_parser("bot-polling").set_defaults(f=bot_polling)
    args = p.parse_args()
    args.f(args)


if __name__ == "__main__":
    main()
