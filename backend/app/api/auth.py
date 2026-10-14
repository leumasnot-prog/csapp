from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import audit
from ..config import get_settings
from ..db import get_db
from ..deps import ip_de, usuario_atual
from ..models import TokenSenha, Usuario
from ..schemas import (
    AlterarSenhaIn,
    EsqueciSenhaIn,
    LoginIn,
    RedefinirSenhaIn,
    TokenOut,
    UsuarioOut,
)
from ..security import (
    SENHA_HASH_FICTICIO,
    conferir_senha,
    criar_jwt,
    hash_senha,
    sha256,
    token_url,
)
from ..services import notificacoes
from ..services.cpf import somente_digitos
from ..tempo import agora

router = APIRouter(prefix="/api/auth", tags=["auth"])


class _Limitador:
    """Limite de tentativas em memória (por processo). Para várias instâncias
    da API, troque por Redis."""

    def __init__(self):
        self._eventos: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def excedido(self, chave: str) -> bool:
        cfg = get_settings()
        agora_ = time.monotonic()
        with self._lock:
            fila = self._eventos[chave]
            while fila and agora_ - fila[0] > cfg.login_janela_segundos:
                fila.popleft()
            return len(fila) >= cfg.login_max_tentativas

    def registrar(self, chave: str) -> None:
        with self._lock:
            self._eventos[chave].append(time.monotonic())

    def limpar(self, chave: str) -> None:
        with self._lock:
            self._eventos.pop(chave, None)


limitador = _Limitador()


@router.post("/login", response_model=TokenOut)
def login(dados: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = ip_de(request)
    ident = dados.login.strip().lower()
    chave = f"{ident}|{ip}"
    if limitador.excedido(chave):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Muitas tentativas. Aguarde alguns minutos.")
    cpf = somente_digitos(ident)
    filtros = [Usuario.email == ident]
    if len(cpf) == 11 and "@" not in ident:
        filtros.append(Usuario.cpf == cpf)
    u = db.execute(select(Usuario).where(or_(*filtros))).scalar_one_or_none()
    senha_ok = conferir_senha(dados.senha, u.senha_hash if u else SENHA_HASH_FICTICIO)
    if u is None or not senha_ok or not u.ativo:
        limitador.registrar(chave)
        audit.registrar(db, "LOGIN_FALHOU", "usuario", u.id if u else None, ip=ip,
                        dados={"login": ident[:100]})
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login ou senha incorretos")
    limitador.limpar(chave)
    u.ultimo_login_em = agora()
    audit.registrar(db, "LOGIN", "usuario", u.id, ator_tipo="USUARIO", ator_id=u.id, ip=ip)
    db.commit()
    return TokenOut(access_token=criar_jwt(u.id, u.perfil.value, u.versao_token),
                    usuario=UsuarioOut.model_validate(u))


@router.get("/me", response_model=UsuarioOut)
def me(u: Usuario = Depends(usuario_atual)):
    return u


@router.post("/esqueci-senha", status_code=202)
def esqueci_senha(dados: EsqueciSenhaIn, request: Request, db: Session = Depends(get_db)):
    """Sempre responde 202 (não revela se o e-mail existe)."""
    ip = ip_de(request)
    chave = f"reset|{ip}"
    if limitador.excedido(chave):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas solicitações.")
    limitador.registrar(chave)
    cfg = get_settings()
    u = db.execute(select(Usuario).where(Usuario.email == dados.email.lower())
                   ).scalar_one_or_none()
    if u is not None and u.ativo:
        token = token_url()
        db.add(TokenSenha(usuario_id=u.id, token_hash=sha256(token),
                          expira_em=agora() + timedelta(minutes=cfg.reset_senha_expira_minutos)))
        link = f"{cfg.painel_url.rstrip('/')}/redefinir-senha?token={token}"
        notificacoes.recuperar_senha(db, u, link, cfg.reset_senha_expira_minutos)
        audit.registrar(db, "SENHA_RESET_SOLICITADO", "usuario", u.id, ip=ip)
        db.commit()
    return {"mensagem": "Se o e-mail estiver cadastrado, você receberá um link em instantes."}


@router.post("/redefinir-senha")
def redefinir_senha(dados: RedefinirSenhaIn, request: Request, db: Session = Depends(get_db)):
    t = db.execute(select(TokenSenha).where(TokenSenha.token_hash == sha256(dados.token))
                   .with_for_update()).scalar_one_or_none()
    if t is None or t.usado_em is not None or t.expira_em < agora():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Link inválido ou expirado.")
    u = db.get(Usuario, t.usuario_id)
    u.senha_hash = hash_senha(dados.nova_senha)
    u.versao_token += 1
    t.usado_em = agora()
    audit.registrar(db, "SENHA_REDEFINIDA", "usuario", u.id, ator_tipo="USUARIO", ator_id=u.id,
                    ip=ip_de(request))
    db.commit()
    return {"mensagem": "Senha alterada. Faça login novamente."}


@router.post("/alterar-senha")
def alterar_senha(dados: AlterarSenhaIn, request: Request, db: Session = Depends(get_db),
                  u: Usuario = Depends(usuario_atual)):
    if not conferir_senha(dados.senha_atual, u.senha_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Senha atual incorreta.")
    u.senha_hash = hash_senha(dados.nova_senha)
    u.versao_token += 1
    audit.registrar(db, "SENHA_ALTERADA", "usuario", u.id, ator_tipo="USUARIO", ator_id=u.id,
                    ip=ip_de(request))
    db.commit()
    return TokenOut(access_token=criar_jwt(u.id, u.perfil.value, u.versao_token),
                    usuario=UsuarioOut.model_validate(u))
