"""Testes rodam contra um PostgreSQL REAL: locks, SKIP LOCKED, índices
parciais e triggers fazem parte do que está sendo testado.

    export SUBST_TEST_DATABASE_URL=postgresql+psycopg://subst:subst@localhost:5432/subst_test
"""
from __future__ import annotations

import os
from datetime import date, datetime, time, timedelta, timezone

import pytest
from sqlalchemy import text

os.environ.setdefault("SUBST_SECRET_KEY", "chave-de-teste-com-pelo-menos-32-bytes")
os.environ.setdefault("SUBST_TELEGRAM_WEBHOOK_SECRET", "segredo-webhook")

from app import db as dbmod  # noqa: E402
from app import messaging, tempo  # noqa: E402
from app.messaging.fake import FakeEmail, FakeMensageiro  # noqa: E402
from app.models import (  # noqa: E402
    Base,
    Classificacao,
    Configuracao,
    Disciplina,
    Escola,
    Etapa,
    Habilitacao,
    ListaClassificacao,
    Perfil,
    Professor,
    Turno,
    Usuario,
)
from app.security import hash_senha  # noqa: E402

URL = os.environ.get("SUBST_TEST_DATABASE_URL",
                     "postgresql+psycopg://subst:subst@localhost:5432/subst_test")

# Segunda-feira, 10h em São Paulo
AGORA = datetime(2026, 10, 19, 10, 0, tzinfo=tempo.TZ).astimezone(timezone.utc)
SENHA = "senha-forte-123"
_HASH = hash_senha(SENHA)


@pytest.fixture(scope="session", autouse=True)
def _banco():
    dbmod.configurar(URL)
    with dbmod.engine().begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    dbmod.criar_esquema()
    yield


@pytest.fixture(autouse=True)
def _limpar():
    tabelas = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    with dbmod.engine().begin() as c:
        # replica: desliga o trigger que impede TRUNCATE no log de auditoria
        c.execute(text("SET session_replication_role = replica"))
        c.execute(text(f"TRUNCATE {tabelas} RESTART IDENTITY CASCADE"))
        c.execute(text("SET session_replication_role = DEFAULT"))
    yield


@pytest.fixture(autouse=True)
def relogio():
    """Relógio controlável: relogio.avancar(minutos=16)."""

    class Relogio:
        def __init__(self):
            self.atual = AGORA
            tempo.set_agora(self.atual)

        def avancar(self, **kw):
            self.atual += timedelta(**kw)
            tempo.set_agora(self.atual)

    r = Relogio()
    yield r
    tempo.set_agora(None)


@pytest.fixture(autouse=True)
def bot():
    fake, email = FakeMensageiro(), FakeEmail()
    messaging.substituir(fake, email)
    fake.emails = email  # atalho
    yield fake
    messaging.substituir(None, None)


@pytest.fixture
def s():
    sess = dbmod.nova_sessao()
    yield sess
    sess.rollback()
    sess.close()


# ------------------------------------------------------------------ fábricas

def gerar_cpf(n: int) -> str:
    base = [int(c) for c in f"{n:09d}"]
    for k in (9, 10):
        soma = sum(d * (k + 1 - i) for i, d in enumerate(base))
        base.append((soma * 10) % 11 % 10)
    return "".join(map(str, base))


class Mundo:
    """Cenário padrão: 2 escolas, 1 admin, 1 diretor por escola, disciplina
    Polivalente (EF1) e N professores habilitados, vinculados e com consentimento."""

    def __init__(self, s, n_professores: int = 10, **cfg):
        self.s = s
        s.add(Configuracao(id=1, **cfg))
        self.escola = Escola(nome="EMEF A", endereco="Rua A, 1", telefone="1633330001")
        self.escola_b = Escola(nome="EMEF B")
        self.disc = Disciplina(nome="Polivalente", chave="polivalente")
        self.mat = Disciplina(nome="Matemática", chave="matematica")
        self.admin = Usuario(nome="Admin", email="admin@x.gov.br", senha_hash=_HASH,
                             perfil=Perfil.ADMIN)
        self.diretor = Usuario(nome="Diretor A", email="dir.a@x.gov.br", senha_hash=_HASH,
                               perfil=Perfil.DIRETOR, escolas=[self.escola])
        self.diretor_b = Usuario(nome="Diretor B", email="dir.b@x.gov.br", senha_hash=_HASH,
                                 perfil=Perfil.DIRETOR, escolas=[self.escola_b])
        self.lista = ListaClassificacao(nome="PSS 2026", ativa=True)
        s.add_all([self.escola, self.escola_b, self.disc, self.mat, self.admin, self.diretor,
                   self.diretor_b, self.lista])
        s.flush()
        self.profs: list[Professor] = []
        for i in range(1, n_professores + 1):
            self.add_prof(i)
        s.commit()

    def add_prof(self, posicao: int, *, etapa=Etapa.EF1, disc=None, vinculado=True,
                 consentimento=True) -> Professor:
        p = Professor(nome=f"Prof {posicao:02d}", cpf=gerar_cpf(posicao),
                      telefone=f"1699999{posicao:04d}", email=f"p{posicao}@x.com",
                      telegram_chat_id=10_000 + posicao if vinculado else None,
                      consentimento_em=AGORA if consentimento else None)
        p.habilitacoes.append(Habilitacao(etapa=etapa, disciplina_id=(disc or self.disc).id))
        self.s.add(p)
        self.s.flush()
        self.s.add(Classificacao(lista_id=self.lista.id, professor_id=p.id, posicao=posicao))
        self.s.flush()
        self.profs.append(p)
        return p

    def prof(self, posicao: int) -> Professor:
        return self.profs[posicao - 1]

    def dados_solicitacao(self, **kw) -> dict:
        d = dict(escola_id=self.escola.id, disciplina_id=self.disc.id, etapa=Etapa.EF1,
                 turma="3º A", turno=Turno.MANHA, data_inicio=date(2026, 10, 20),
                 data_fim=date(2026, 10, 20), hora_inicio=time(7, 0), hora_fim=time(11, 30))
        d.update(kw)
        return d


@pytest.fixture
def mundo(s):
    return Mundo(s)


def criar_solicitacao(mundo: Mundo, **kw) -> int:
    from app.services import motor

    with dbmod.transacao() as s:
        u = s.get(Usuario, mundo.diretor.id)
        sol = motor.criar_solicitacao(s, u, **mundo.dados_solicitacao(**kw))
        return sol.id
