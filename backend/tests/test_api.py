"""API HTTP: autenticação, perfis e isolamento entre escolas."""
from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app import db as dbmod
from app.api.auth import limitador
from app.main import app
from app.models import LogAcesso
from tests.conftest import SENHA, gerar_cpf
from tests.helpers import conv_de, responder, rodar_worker


@pytest.fixture
def client():
    limitador._eventos.clear()
    return TestClient(app)


def login(client, email, senha=SENHA):
    r = client.post("/api/auth/login", json={"login": email, "senha": senha})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def nova_solicitacao(client, h, mundo, **kw):
    corpo = {"escola_id": mundo.escola.id, "disciplina_id": mundo.disc.id, "etapa": "EF1",
             "turma": "3º A", "turno": "MANHA", "data_inicio": "2026-10-20",
             "data_fim": "2026-10-20", "hora_inicio": "07:00", "hora_fim": "11:30",
             "observacoes": "Trazer material de matemática"}
    corpo.update(kw)
    return client.post("/api/solicitacoes", json=corpo, headers=h)


def test_login_email_ou_cpf_e_senha_errada(client, mundo, s):
    assert client.post("/api/auth/login", json={"login": "dir.a@x.gov.br", "senha": "x"}
                       ).status_code == 401
    mundo.diretor.cpf = gerar_cpf(777)
    s.commit()
    h = login(client, gerar_cpf(777))
    assert client.get("/api/auth/me", headers=h).json()["email"] == "dir.a@x.gov.br"
    assert client.get("/api/auth/me").status_code == 401


def test_limite_de_tentativas_de_login(client, mundo):
    for _ in range(8):
        client.post("/api/auth/login", json={"login": "dir.a@x.gov.br", "senha": "errada"})
    r = client.post("/api/auth/login", json={"login": "dir.a@x.gov.br", "senha": SENHA})
    assert r.status_code == 429


def test_fluxo_diretor_completo(client, mundo, bot):
    h = login(client, "dir.a@x.gov.br")
    assert [e["nome"] for e in client.get("/api/escolas", headers=h).json()] == ["EMEF A"]
    r = nova_solicitacao(client, h, mundo)
    assert r.status_code == 201, r.text
    det = r.json()
    assert det["status"] == "EM_CONVOCACAO" and det["onda_atual"] == 1
    assert [c["posicao"] for c in det["ondas"][0]["convocacoes"]] == [1, 2, 3]
    assert det["contato_professor"] is None

    sid = det["id"]
    rodar_worker()
    responder(conv_de(sid, 3).id, mundo.prof(3).id)
    det = client.get(f"/api/solicitacoes/{sid}", headers=h).json()
    assert det["status"] == "PREENCHIDA"
    assert det["contato_professor"] == {"nome": "Prof 03", "telefone": "16999990003",
                                        "email": "p3@x.com"}
    st = {c["posicao"]: c["status_texto"] for c in det["ondas"][0]["convocacoes"]}
    assert st == {1: "Vaga preenchida por outro", 2: "Vaga preenchida por outro", 3: "Aceitou"}

    lista = client.get("/api/solicitacoes", headers=h).json()
    assert [x["id"] for x in lista] == [sid]

    comp = client.get(f"/api/solicitacoes/{sid}/comprovacao", headers=h).json()
    assert comp["conforme"] is True
    csv = client.get(f"/api/solicitacoes/{sid}/comprovacao?formato=csv", headers=h)
    assert "CONVOCADO" in csv.text and csv.headers["content-type"].startswith("text/csv")

    r = client.post(f"/api/solicitacoes/{sid}/cancelar", json={"motivo": "titular voltou"},
                    headers=h)
    assert r.json()["status"] == "CANCELADA"
    r = client.post(f"/api/solicitacoes/{sid}/reabrir", headers=h)
    assert r.json()["status"] == "EM_CONVOCACAO" and r.json()["ciclo"] == 2


def test_isolamento_entre_escolas(client, mundo):
    ha = login(client, "dir.a@x.gov.br")
    hb = login(client, "dir.b@x.gov.br")
    sid = nova_solicitacao(client, ha, mundo).json()["id"]

    assert client.get(f"/api/solicitacoes/{sid}", headers=hb).status_code == 404
    assert client.get(f"/api/solicitacoes/{sid}/comprovacao", headers=hb).status_code == 404
    assert client.post(f"/api/solicitacoes/{sid}/cancelar", json={}, headers=hb).status_code == 404
    assert client.post(f"/api/solicitacoes/{sid}/reabrir", headers=hb).status_code == 404
    assert client.get("/api/solicitacoes", headers=hb).json() == []
    assert client.get(f"/api/solicitacoes?escola_id={mundo.escola.id}",
                      headers=hb).status_code == 404
    # diretor B não cria solicitação para a escola A
    assert nova_solicitacao(client, hb, mundo).status_code == 404
    assert [e["nome"] for e in client.get("/api/escolas", headers=hb).json()] == ["EMEF B"]


def test_diretor_nao_acessa_rotas_admin(client, mundo):
    h = login(client, "dir.a@x.gov.br")
    for rota in ("/api/admin/escolas", "/api/admin/professores", "/api/admin/painel",
                 "/api/admin/configuracao", "/api/admin/auditoria"):
        assert client.get(rota, headers=h).status_code == 403, rota


def test_admin_crud_e_painel(client, mundo):
    h = login(client, "admin@x.gov.br")
    r = client.post("/api/admin/escolas", json={"nome": "EMEI Nova", "codigo_inep": "35000001"},
                    headers=h)
    assert r.status_code == 201
    eid = r.json()["id"]
    assert client.post("/api/admin/escolas", json={"nome": "EMEI Nova"},
                       headers=h).status_code == 409
    r = client.post("/api/admin/usuarios", json={
        "nome": "Nova Diretora", "email": "Nova@X.gov.br", "perfil": "diretor",
        "escola_ids": [eid]}, headers=h)
    assert r.status_code == 201 and r.json()["senha_provisoria"]
    hn = login(client, "nova@x.gov.br", r.json()["senha_provisoria"])
    assert [e["id"] for e in client.get("/api/escolas", headers=hn).json()] == [eid]

    r = client.post("/api/admin/usuarios", json={
        "nome": "Sem Escola", "email": "se@x.gov.br", "perfil": "diretor"}, headers=h)
    assert r.status_code == 422

    profs = client.get("/api/admin/professores", headers=h).json()
    assert profs[0]["posicao"] == 1 and profs[0]["cpf_mascarado"].startswith("***.")
    assert "cpf" not in profs[0]

    cod = client.post(f"/api/admin/professores/{profs[0]['id']}/codigo-vinculo", headers=h).json()
    assert re.fullmatch(r"\d{6}", cod["codigo"])

    ha = login(client, "dir.a@x.gov.br")
    nova_solicitacao(client, ha, mundo)
    painel = client.get("/api/admin/painel", headers=h).json()
    assert painel["indicadores"]["total"] == 1
    csv = client.get("/api/admin/relatorios/solicitacoes.csv", headers=h)
    assert csv.status_code == 200 and "EMEF A" in csv.text

    cfg = client.get("/api/admin/configuracao", headers=h).json()
    cfg["timeout_minutos"] = 30
    cfg["politica_recusa"] = "FIM_DA_LISTA"
    assert client.put("/api/admin/configuracao", json=cfg, headers=h).json()["timeout_minutos"] == 30

    ver = client.get("/api/admin/auditoria/verificar", headers=h).json()
    assert ver["ok"] and ver["total"] == ver["registros"] > 5


def test_importacao_via_api(client, mundo):
    h = login(client, "admin@x.gov.br")
    conteudo = (f"posicao;nome;cpf;habilitacoes\n1;Zé Novo;{gerar_cpf(901)};EF1:Polivalente\n"
                ).encode()
    arq = {"arquivo": ("l.csv", conteudo, "text/csv")}
    r = client.post("/api/admin/listas/importar", files=arq, data={"nome": "Nova lista"},
                    headers=h)
    assert r.status_code == 200 and r.json()["ok"] and not r.json()["confirmado"]
    r = client.post("/api/admin/listas/importar", files=arq,
                    data={"nome": "Nova lista", "confirmar": "true"}, headers=h)
    assert r.json()["confirmado"] and r.json()["lista_id"]
    listas = client.get("/api/admin/listas", headers=h).json()
    assert [x["ativa"] for x in listas if x["nome"] == "Nova lista"] == [True]


def test_troca_de_senha_derruba_token_antigo_e_reset(client, mundo, bot):
    h = login(client, "dir.a@x.gov.br")
    r = client.post("/api/auth/alterar-senha", json={"senha_atual": SENHA,
                                                     "nova_senha": "outra-senha-1"}, headers=h)
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401

    assert client.post("/api/auth/esqueci-senha", json={"email": "naoexiste@x.gov.br"}
                       ).status_code == 202
    assert client.post("/api/auth/esqueci-senha", json={"email": "dir.a@x.gov.br"}
                       ).status_code == 202
    rodar_worker()
    corpo = bot.emails.enviados[-1]["corpo"]
    token = re.search(r"token=([\w-]+)", corpo)[1]
    r = client.post("/api/auth/redefinir-senha", json={"token": token, "nova_senha": "nova-12345"})
    assert r.status_code == 200
    assert client.post("/api/auth/redefinir-senha", json={"token": token, "nova_senha": "x" * 9}
                       ).status_code == 400  # uso único
    login(client, "dir.a@x.gov.br", "nova-12345")


def test_log_de_acesso_lgpd(client, mundo):
    h = login(client, "dir.a@x.gov.br")
    client.get("/api/solicitacoes", headers=h)
    with dbmod.transacao() as s:
        rotas = s.execute(select(LogAcesso.rota)).scalars().all()
        assert "/api/solicitacoes" in rotas
        assert s.execute(select(func.count()).select_from(LogAcesso)
                         .where(LogAcesso.usuario_id.is_(None))).scalar() == 0


def test_webhook_exige_segredo(client):
    assert client.post("/api/bot/telegram/webhook", json={}).status_code == 403
    r = client.post("/api/bot/telegram/webhook", json={"update_id": 1},
                    headers={"X-Telegram-Bot-Api-Secret-Token": "segredo-webhook"})
    assert r.status_code == 200


def test_solicitacao_sem_lista_ativa(client, mundo, s):
    mundo.lista.ativa = False
    s.commit()
    h = login(client, "dir.a@x.gov.br")
    r = nova_solicitacao(client, h, mundo)
    assert r.status_code == 422 and "lista" in r.json()["detail"]
