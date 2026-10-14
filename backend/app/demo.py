"""Dados de demonstração para desenvolvimento local (NÃO usar em produção)."""
from __future__ import annotations

import random

from sqlalchemy import select

from .db import criar_esquema, transacao
from .models import Escola, Perfil, Usuario
from .security import hash_senha
from .services import importacao


def _cpf(rng: random.Random) -> str:
    base = [rng.randint(0, 9) for _ in range(9)]
    for n in (9, 10):
        soma = sum(d * (n + 1 - i) for i, d in enumerate(base))
        base.append((soma * 10) % 11 % 10)
    return "".join(map(str, base))


NOMES = ["Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Hugo", "Isabel",
         "João", "Karina", "Lucas", "Marina", "Nelson", "Olívia", "Paulo", "Renata", "Sérgio",
         "Tatiana", "Vítor"]
SOBRENOMES = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Costa", "Almeida"]
HABS = ["EF1:Polivalente", "EI:Polivalente", "EF2:Matemática", "EF2:Língua Portuguesa",
        "EF2:Ciências", "EF1:Educação Física|EF2:Educação Física", "EF1:Arte|EF2:Arte",
        "EF2:Inglês"]


def csv_demo(n: int = 40, semente: int = 7) -> bytes:
    rng = random.Random(semente)
    linhas = ["posicao;nome;cpf;email;telefone;habilitacoes"]
    for i in range(1, n + 1):
        nome = f"{rng.choice(NOMES)} {rng.choice(SOBRENOMES)} {rng.choice(SOBRENOMES)}"
        hab = rng.choice(HABS)
        if rng.random() < 0.4:
            hab = "EF1:Polivalente|" + hab if "EF1:Polivalente" not in hab else hab
        linhas.append(f"{i};{nome};{_cpf(rng)};prof{i}@exemplo.com;1699999{i:04d};{hab}")
    return "\n".join(linhas).encode()


def simular_vinculo() -> None:
    """Somente desenvolvimento: marca todos os professores como vinculados ao
    bot (chat_id fictício = 900000 + id) e com consentimento."""
    from .models import Professor
    from .tempo import agora

    with transacao() as s:
        for p in s.execute(select(Professor)).scalars():
            p.telegram_chat_id = p.telegram_chat_id or 900000 + p.id
            p.consentimento_em = p.consentimento_em or agora()
            p.consentimento_revogado_em = None
    print("Professores vinculados (simulação): chat_id = 900000 + id do professor.")


def popular() -> None:
    criar_esquema()
    with transacao() as s:
        if s.execute(select(Usuario).where(Usuario.email == "admin@exemplo.gov.br")).scalar():
            print("Demo já populada.")
            return
        escolas = [Escola(nome=n, endereco=f"Rua {i}, {100 + i}", telefone=f"(16) 3333-00{i:02d}")
                   for i, n in enumerate(["EMEF Monteiro Lobato", "EMEI Cecília Meireles",
                                          "EMEF Paulo Freire"], start=1)]
        s.add_all(escolas)
        admin = Usuario(nome="Secretaria (demo)", email="admin@exemplo.gov.br",
                        senha_hash=hash_senha("admin12345"), perfil=Perfil.ADMIN)
        diretor = Usuario(nome="Diretora Demo", email="diretor@exemplo.gov.br",
                          senha_hash=hash_senha("diretor12345"), perfil=Perfil.DIRETOR,
                          escolas=[escolas[0]])
        diretor2 = Usuario(nome="Diretor Demo 2", email="diretor2@exemplo.gov.br",
                           senha_hash=hash_senha("diretor12345"), perfil=Perfil.DIRETOR,
                           escolas=[escolas[1], escolas[2]])
        s.add_all([admin, diretor, diretor2])
        s.flush()
        res = importacao.importar(s, usuario=admin, nome_arquivo="demo.csv", conteudo=csv_demo(),
                                  nome_lista="PSS 2026 — Professor (demo)", edital="01/2026",
                                  ativar=True, confirmar=True)
        assert res.ok, res.erros
    print("Demo criada:\n  admin@exemplo.gov.br / admin12345\n"
          "  diretor@exemplo.gov.br / diretor12345\n  diretor2@exemplo.gov.br / diretor12345\n"
          "Professores ainda não estão vinculados ao bot: gere códigos no painel admin.")
