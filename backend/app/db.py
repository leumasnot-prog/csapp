from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def configurar(url: str | None = None) -> None:
    global _engine, _SessionLocal
    url = url or get_settings().database_url
    _engine = create_engine(url, pool_pre_ping=True, pool_size=10, max_overflow=20)
    _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)


def engine():
    if _engine is None:
        configurar()
    return _engine


def nova_sessao() -> Session:
    if _SessionLocal is None:
        configurar()
    return _SessionLocal()


@contextmanager
def transacao() -> Iterator[Session]:
    """Sessão com commit no sucesso e rollback em exceção."""
    s = nova_sessao()
    try:
        yield s
        s.commit()
    except BaseException:
        s.rollback()
        raise
    finally:
        s.close()


def get_db() -> Iterator[Session]:
    """Dependência FastAPI."""
    s = nova_sessao()
    try:
        yield s
    finally:
        s.close()


# DDL que o SQLAlchemy não expressa declarativamente: imutabilidade do log.
DDL_EXTRA = [
    """
    CREATE OR REPLACE FUNCTION log_auditoria_imutavel() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION USING MESSAGE = 'log_auditoria é somente-inserção: ' || TG_OP || ' bloqueado';
    END;
    $$ LANGUAGE plpgsql;
    """,
    "DROP TRIGGER IF EXISTS trg_log_auditoria_imutavel ON log_auditoria;",
    """
    CREATE TRIGGER trg_log_auditoria_imutavel
      BEFORE UPDATE OR DELETE ON log_auditoria
      FOR EACH ROW EXECUTE FUNCTION log_auditoria_imutavel();
    """,
    "DROP TRIGGER IF EXISTS trg_log_auditoria_truncate ON log_auditoria;",
    """
    CREATE TRIGGER trg_log_auditoria_truncate
      BEFORE TRUNCATE ON log_auditoria
      FOR EACH STATEMENT EXECUTE FUNCTION log_auditoria_imutavel();
    """,
]


def criar_esquema() -> None:
    from . import models  # noqa: F401  (registra os modelos)

    eng = engine()
    Base.metadata.create_all(eng)
    with eng.begin() as conn:
        for ddl in DDL_EXTRA:
            conn.execute(text(ddl))
