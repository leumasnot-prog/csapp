import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import get_settings


def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode()[:72], bcrypt.gensalt(rounds=12)).decode()


def conferir_senha(senha: str, senha_hash: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode()[:72], senha_hash.encode())
    except ValueError:
        return False


# Hash "falso" para igualar o tempo de resposta quando o usuário não existe.
SENHA_HASH_FICTICIO = bcrypt.hashpw(b"senha-ficticia", bcrypt.gensalt(rounds=12)).decode()


def sha256(valor: str) -> str:
    return hashlib.sha256(valor.encode()).hexdigest()


def iguais(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


def token_url() -> str:
    return secrets.token_urlsafe(32)


def codigo_numerico(digitos: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(digitos))


def criar_jwt(usuario_id: int, perfil: str, versao_token: int) -> str:
    cfg = get_settings()
    # Relógio real (não o relógio de negócio, que pode estar congelado em testes)
    agora_ = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario_id),
        "perfil": perfil,
        "v": versao_token,
        "iat": int(agora_.timestamp()),
        "exp": int((agora_ + timedelta(hours=cfg.jwt_expira_horas)).timestamp()),
    }
    return jwt.encode(payload, cfg.secret_key, algorithm="HS256")


def ler_jwt(token: str) -> dict:
    return jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
