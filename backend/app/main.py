from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from .api import admin, auth, bot, solicitacoes
from .config import get_settings
from .db import transacao
from .deps import ip_de
from .models import LogAcesso

log = logging.getLogger("app")

app = FastAPI(
    title="Substituição de Professores — Rede Municipal",
    version="0.1.0",
    description="Convocação de professores substitutos por ondas, respeitando a classificação.",
)
app.include_router(auth.router)
app.include_router(solicitacoes.router)
app.include_router(admin.router)
app.include_router(bot.router)


def _gravar_acesso(dados: dict) -> None:
    try:
        with transacao() as s:
            s.add(LogAcesso(**dados))
    except Exception:
        log.exception("falha ao gravar log de acesso")


@app.middleware("http")
async def log_de_acesso(request: Request, call_next):
    """LGPD: registra quem acessou o quê (somente requisições autenticadas)."""
    response = await call_next(request)
    usuario_id = getattr(request.state, "usuario_id", None)
    if usuario_id is not None:
        await run_in_threadpool(_gravar_acesso, {
            "usuario_id": usuario_id, "metodo": request.method,
            "rota": str(request.url.path)[:300], "status_http": response.status_code,
            "ip": ip_de(request), "user_agent": (request.headers.get("user-agent") or "")[:300],
        })
    return response


@app.middleware("http")
async def cabecalhos_seguranca(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/api/health", tags=["infra"])
def health():
    return {"ok": True}


# ------------------------------------------------------------------ SPA (frontend compilado)
_dist = (Path(__file__).resolve().parent.parent / get_settings().frontend_dist).resolve()
if (_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{caminho:path}", include_in_schema=False)
    def spa(caminho: str):
        if caminho.startswith("api/"):
            return JSONResponse({"detail": "Não encontrado"}, status_code=404)
        alvo = (_dist / caminho).resolve()
        if caminho and alvo.is_file() and _dist in alvo.parents:
            return FileResponse(alvo)
        return FileResponse(_dist / "index.html")
