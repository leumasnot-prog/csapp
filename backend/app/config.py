"""Configuração de infraestrutura (variáveis de ambiente).

Regras de negócio configuráveis pela Secretaria NÃO ficam aqui: ficam na tabela
`configuracao` (ver models.Configuracao), editável pelo painel admin.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SUBST_", extra="ignore")

    database_url: str = "postgresql+psycopg://subst:subst@localhost:5432/subst_dev"
    secret_key: str = "troque-esta-chave-em-producao"
    jwt_expira_horas: int = 10
    reset_senha_expira_minutos: int = 60

    # URL pública do painel, usada nos links de e-mail (recuperação de senha).
    painel_url: str = "http://localhost:8000"

    # Mensageria: "telegram" ou "fake" (dev/testes: apenas registra no log).
    mensageiro: str = "fake"
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""
    telegram_bot_username: str = ""

    # E-mail: "smtp" ou "fake".
    email_backend: str = "fake"
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_usuario: str = ""
    smtp_senha: str = ""
    smtp_tls: bool = True
    email_remetente: str = "nao-responda@educacao.example.gov.br"

    # Worker
    worker_intervalo_segundos: float = 2.0
    outbox_max_tentativas: int = 6

    # Login: tentativas por janela (por identificador + IP)
    login_max_tentativas: int = 8
    login_janela_segundos: int = 900

    # Só ative atrás de um proxy reverso que sobrescreve X-Forwarded-For.
    confiar_x_forwarded_for: bool = False

    frontend_dist: str = "../frontend/dist"


@lru_cache
def get_settings() -> Settings:
    return Settings()
