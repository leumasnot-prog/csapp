from __future__ import annotations

import io

from openpyxl import Workbook
from sqlalchemy import func, select

from app.models import (
    Classificacao,
    Disciplina,
    Etapa,
    ListaClassificacao,
    Perfil,
    Professor,
    Usuario,
)
from app.services import importacao
from tests.conftest import _HASH, gerar_cpf


def _admin(s):
    u = Usuario(nome="Adm", email="a@x.gov.br", senha_hash=_HASH, perfil=Perfil.ADMIN)
    s.add(u)
    s.flush()
    return u


def _csv(*linhas, cab="posicao;nome;cpf;email;telefone;habilitacoes"):
    return ("\n".join([cab, *linhas])).encode("utf-8")


def _imp(s, conteudo, nome="lista.csv", confirmar=True, ativar=True):
    return importacao.importar(s, usuario=_admin(s), nome_arquivo=nome, conteudo=conteudo,
                               nome_lista="PSS 2026", edital="01/2026", ativar=ativar,
                               confirmar=confirmar)


def test_importa_csv_valido_e_ativa(s):
    c1, c2 = gerar_cpf(11), gerar_cpf(12)
    res = _imp(s, _csv(f"1;Ana Silva;{c1};ana@x.com;(16) 99999-0001;EF1:Polivalente",
                       f"2;Bruno Lima;{c2[:3]}.{c2[3:6]}.{c2[6:9]}-{c2[9:]};;;"
                       "EF2:Matemática | EF2:Ciências"))
    assert res.ok and not res.erros, res.erros
    assert res.professores_novos == 2
    assert sorted(res.disciplinas_novas) == ["Ciências", "Matemática", "Polivalente"]
    s.commit()
    lista = s.get(ListaClassificacao, res.lista_id)
    assert lista.ativa and lista.arquivo_sha256
    bruno = s.execute(select(Professor).where(Professor.cpf == c2)).scalar_one()
    assert {(h.etapa, h.disciplina.nome) for h in bruno.habilitacoes} == {
        (Etapa.EF2, "Matemática"), (Etapa.EF2, "Ciências")}


def test_validacao_aponta_erros_por_linha_e_nao_grava_nada(s):
    c = gerar_cpf(21)
    res = _imp(s, _csv(
        f"1;Ana Silva;{c};;;EF1:Polivalente",
        f"1;Repetida Pos;{gerar_cpf(22)};;;EF1:Polivalente",
        "3;CPF Ruim;123.456.789-00;;;EF1:Polivalente",
        f"4;CPF Dup;{c};;;EF1:Polivalente",
        f"5;Etapa Ruim;{gerar_cpf(25)};;;Médio:Física",
        f"x;Sem Pos;{gerar_cpf(26)};;;EF1:Polivalente",
        f"7;Sem Hab;{gerar_cpf(27)};;;",
    ))
    assert not res.ok
    erros = {(e.linha, e.campo) for e in res.erros}
    assert erros == {(3, "posicao"), (4, "cpf"), (5, "cpf"), (6, "habilitacoes"),
                     (7, "posicao"), (8, "habilitacoes")}
    s.commit()
    assert s.execute(select(func.count()).select_from(Professor)).scalar() == 0
    assert s.execute(select(func.count()).select_from(ListaClassificacao)).scalar() == 0


def test_cabecalho_faltando(s):
    res = _imp(s, _csv("1;Ana;x", cab="posicao;nome;cpf"))
    assert not res.ok and "habilitacoes" in res.erros[0].mensagem


def test_dry_run_mostra_previa_sem_gravar(s):
    res = _imp(s, _csv(f"1;Ana Silva;{gerar_cpf(31)};;;Anos iniciais - Polivalente"),
               confirmar=False)
    assert res.ok and res.lista_id is None and res.previa[0]["habilitacoes"] == ["EF1:Polivalente"]
    s.commit()
    assert s.execute(select(func.count()).select_from(Professor)).scalar() == 0


def test_lacuna_de_posicao_gera_aviso_nao_erro(s):
    res = _imp(s, _csv(f"1;Ana Silva;{gerar_cpf(41)};;;EF1:Polivalente",
                       f"3;Caio Souza;{gerar_cpf(42)};;;EF1:Polivalente"))
    assert res.ok and any("ausentes" in a.mensagem for a in res.avisos)


def test_xlsx_e_cpf_sem_zeros_a_esquerda(s):
    cpf = gerar_cpf(5)  # começa com zeros
    assert cpf.startswith("0")
    wb = Workbook()
    ws = wb.active
    ws.append(["Classificação", "Nome completo", "CPF", "Habilitações"])
    ws.append([1, "Ana Silva", int(cpf), "EI:Polivalente"])
    buf = io.BytesIO()
    wb.save(buf)
    res = _imp(s, buf.getvalue(), nome="lista.xlsx")
    assert res.ok, res.erros
    s.commit()
    assert s.execute(select(Professor.cpf)).scalar_one() == cpf


def test_reimportacao_atualiza_professor_e_troca_lista_ativa(s):
    cpf = gerar_cpf(51)
    r1 = _imp(s, _csv(f"1;Ana Silva;{cpf};;;EF1:Polivalente"))
    s.commit()
    prof = s.execute(select(Professor)).scalar_one()
    prof.telegram_chat_id = 999  # vínculo do bot deve ser preservado
    s.commit()
    s.add(Disciplina(nome="Arte", chave="arte"))
    s.commit()
    r2 = importacao.importar(s, usuario=s.execute(select(Usuario)).scalars().first(),
                             nome_arquivo="l2.csv",
                             conteudo=_csv(f"2;Ana Silva Souza;{cpf};;;EF1:arte"),
                             nome_lista="PSS 2026 - retificada", edital=None, ativar=True,
                             confirmar=True)
    assert r2.ok and r2.professores_atualizados == 1 and r2.disciplinas_novas == []
    s.commit()
    s.expire_all()
    prof = s.execute(select(Professor)).scalar_one()
    assert prof.nome == "Ana Silva Souza" and prof.telegram_chat_id == 999
    assert [h.disciplina.nome for h in prof.habilitacoes] == ["Arte"]
    ativas = s.execute(select(ListaClassificacao).where(ListaClassificacao.ativa)).scalars().all()
    assert [lista.id for lista in ativas] == [r2.lista_id]
    assert s.execute(select(Classificacao.posicao).where(
        Classificacao.lista_id == r1.lista_id)).scalar_one() == 1


def test_formato_nao_suportado(s):
    try:
        _imp(s, b"%PDF", nome="lista.pdf")
        raise AssertionError
    except importacao.ArquivoInvalido:
        pass
