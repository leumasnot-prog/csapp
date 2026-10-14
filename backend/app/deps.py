"""Autenticação, autorização e isolamento entre escolas."""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Perfil, Solicitacao, Usuario
from .security import ler_jwt

_bearer = HTTPBearer(auto_error=False)


def ip_de(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd and get_settings().confiar_x_forwarded_for:
        return fwd.split(",")[0].strip()[:45]
    return request.client.host if request.client else None


def usuario_atual(request: Request,
                  cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
                  db: Session = Depends(get_db)) -> Usuario:
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    try:
        payload = ler_jwt(cred.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada")
    u = db.get(Usuario, int(payload["sub"]))
    if u is None or not u.ativo or payload.get("v") != u.versao_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada")
    request.state.usuario_id = u.id  # para o log de acesso
    return u


def exigir_admin(u: Usuario = Depends(usuario_atual)) -> Usuario:
    if u.perfil != Perfil.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso restrito à Secretaria")
    return u


def escolas_permitidas(u: Usuario) -> list[int] | None:
    """None = todas (admin). Diretor: só as escolas vinculadas."""
    if u.perfil == Perfil.ADMIN:
        return None
    return [e.id for e in u.escolas if e.ativa]


def checar_escola(u: Usuario, escola_id: int) -> None:
    permitidas = escolas_permitidas(u)
    if permitidas is not None and escola_id not in permitidas:
        # 404 e não 403: não revela que a escola/solicitação existe.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Não encontrado")


def solicitacao_do_usuario(db: Session, u: Usuario, solicitacao_id: int) -> Solicitacao:
    sol = db.get(Solicitacao, solicitacao_id)
    if sol is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Não encontrado")
    checar_escola(u, sol.escola_id)
    return sol
