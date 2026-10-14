"""Endpoints exclusivos da Secretaria (perfil admin)."""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .. import audit
from ..db import get_db
from ..deps import exigir_admin, ip_de
from ..models import (
    Classificacao,
    Disciplina,
    Escola,
    ListaClassificacao,
    LogAuditoria,
    Perfil,
    Professor,
    StatusSolicitacao,
    Usuario,
)
from ..schemas import (
    CodigoVinculoOut,
    ConfiguracaoIO,
    DisciplinaIn,
    DisciplinaOut,
    EscolaIn,
    EscolaOut,
    ImportacaoOut,
    ListaOut,
    ProfessorIn,
    ProfessorOut,
    UsuarioIn,
    UsuarioOut,
)
from ..security import codigo_numerico, hash_senha, sha256, token_url
from ..services import configuracao, importacao, relatorios
from ..services.cpf import chave, mascarar_cpf
from ..tempo import agora
from .solicitacoes import resumo

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(exigir_admin)])

MAX_UPLOAD = 5 * 1024 * 1024


def _ator(u: Usuario, request: Request) -> dict:
    return {"ator_tipo": "USUARIO", "ator_id": u.id, "ip": ip_de(request)}


def _commit(db: Session, msg_conflito: str, *, apenas_flush: bool = False) -> None:
    try:
        db.flush() if apenas_flush else db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, msg_conflito)


# ------------------------------------------------------------------ escolas

@router.get("/escolas", response_model=list[EscolaOut])
def listar_escolas(db: Session = Depends(get_db)):
    return db.execute(select(Escola).order_by(Escola.nome)).scalars().all()


@router.post("/escolas", response_model=EscolaOut, status_code=201)
def criar_escola(dados: EscolaIn, request: Request, db: Session = Depends(get_db),
                 u: Usuario = Depends(exigir_admin)):
    e = Escola(**dados.model_dump())
    db.add(e)
    _commit(db, "Já existe escola com esse nome ou código INEP.", apenas_flush=True)
    audit.registrar(db, "ESCOLA_CRIADA", "escola", e.id, escola_id=e.id,
                    dados=dados.model_dump(), **_ator(u, request))
    _commit(db, "Já existe escola com esse nome ou código INEP.")
    return e


@router.put("/escolas/{escola_id}", response_model=EscolaOut)
def editar_escola(escola_id: int, dados: EscolaIn, request: Request,
                  db: Session = Depends(get_db), u: Usuario = Depends(exigir_admin)):
    e = db.get(Escola, escola_id) or _404()
    for k, v in dados.model_dump().items():
        setattr(e, k, v)
    audit.registrar(db, "ESCOLA_EDITADA", "escola", e.id, escola_id=e.id,
                    dados=dados.model_dump(), **_ator(u, request))
    _commit(db, "Já existe escola com esse nome ou código INEP.")
    return e


@router.delete("/escolas/{escola_id}", status_code=204)
def desativar_escola(escola_id: int, request: Request, db: Session = Depends(get_db),
                     u: Usuario = Depends(exigir_admin)):
    """Exclusão lógica: o histórico precisa continuar consultável."""
    e = db.get(Escola, escola_id) or _404()
    e.ativa = False
    audit.registrar(db, "ESCOLA_DESATIVADA", "escola", e.id, escola_id=e.id, **_ator(u, request))
    db.commit()


def _404():
    raise HTTPException(404, "Não encontrado")


# ------------------------------------------------------------------ usuários

def _aplicar_usuario(db: Session, usr: Usuario, dados: UsuarioIn) -> None:
    usr.nome = dados.nome
    usr.email = dados.email.lower()
    if dados.cpf is not None:  # vazio na edição = manter o atual
        usr.cpf = dados.cpf
    usr.telefone = dados.telefone
    usr.perfil = dados.perfil
    usr.ativo = dados.ativo
    escolas = db.execute(select(Escola).where(Escola.id.in_(dados.escola_ids))).scalars().all()
    if len(escolas) != len(set(dados.escola_ids)):
        raise HTTPException(422, "Escola inexistente na lista de vínculos.")
    if dados.perfil == Perfil.DIRETOR and not escolas:
        raise HTTPException(422, "Diretor precisa estar vinculado a pelo menos uma escola.")
    usr.escolas = list(escolas)


@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db)):
    return db.execute(select(Usuario).options(selectinload(Usuario.escolas))
                      .order_by(Usuario.nome)).scalars().all()


@router.post("/usuarios", status_code=201)
def criar_usuario(dados: UsuarioIn, request: Request, db: Session = Depends(get_db),
                  u: Usuario = Depends(exigir_admin)):
    """Sem senha informada, gera uma senha provisória exibida uma única vez."""
    senha = dados.senha or token_url()[:12]
    usr = Usuario(senha_hash=hash_senha(senha), nome="", email="", perfil=dados.perfil)
    _aplicar_usuario(db, usr, dados)
    db.add(usr)
    _commit(db, "E-mail ou CPF já cadastrado.", apenas_flush=True)
    audit.registrar(db, "USUARIO_CRIADO", "usuario", usr.id, dados={
        "perfil": dados.perfil.value, "escola_ids": dados.escola_ids, "email": usr.email,
    }, **_ator(u, request))
    _commit(db, "E-mail ou CPF já cadastrado.")
    return {"usuario": UsuarioOut.model_validate(usr),
            "senha_provisoria": None if dados.senha else senha}


@router.put("/usuarios/{usuario_id}", response_model=UsuarioOut)
def editar_usuario(usuario_id: int, dados: UsuarioIn, request: Request,
                   db: Session = Depends(get_db), u: Usuario = Depends(exigir_admin)):
    usr = db.get(Usuario, usuario_id) or _404()
    if usr.id == u.id and (not dados.ativo or dados.perfil != Perfil.ADMIN):
        raise HTTPException(422, "Você não pode remover seu próprio acesso de administrador.")
    perfil_ou_escolas_mudou = (usr.perfil != dados.perfil
                               or {e.id for e in usr.escolas} != set(dados.escola_ids)
                               or usr.ativo != dados.ativo)
    _aplicar_usuario(db, usr, dados)
    if dados.senha:
        usr.senha_hash = hash_senha(dados.senha)
    if dados.senha or perfil_ou_escolas_mudou:
        usr.versao_token += 1  # derruba sessões abertas
    audit.registrar(db, "USUARIO_EDITADO", "usuario", usr.id, dados={
        "perfil": dados.perfil.value, "escola_ids": dados.escola_ids, "ativo": dados.ativo,
        "senha_redefinida": bool(dados.senha),
    }, **_ator(u, request))
    _commit(db, "E-mail ou CPF já cadastrado.")
    return usr


# ------------------------------------------------------------------ disciplinas

@router.get("/disciplinas", response_model=list[DisciplinaOut])
def listar_disciplinas(db: Session = Depends(get_db)):
    return db.execute(select(Disciplina).order_by(Disciplina.nome)).scalars().all()


@router.post("/disciplinas", response_model=DisciplinaOut, status_code=201)
def criar_disciplina(dados: DisciplinaIn, request: Request, db: Session = Depends(get_db),
                     u: Usuario = Depends(exigir_admin)):
    d = Disciplina(nome=dados.nome.strip(), chave=chave(dados.nome))
    db.add(d)
    _commit(db, "Disciplina já cadastrada.", apenas_flush=True)
    audit.registrar(db, "DISCIPLINA_CRIADA", "disciplina", d.id, dados={"nome": d.nome},
                    **_ator(u, request))
    _commit(db, "Disciplina já cadastrada.")
    return d


# ------------------------------------------------------------------ professores

def professor_out(p: Professor, posicao: int | None = None) -> ProfessorOut:
    return ProfessorOut(
        id=p.id, nome=p.nome, cpf_mascarado=mascarar_cpf(p.cpf), email=p.email,
        telefone=p.telefone, ativo=p.ativo, suspenso_ate=p.suspenso_ate,
        vinculado_bot=p.telegram_chat_id is not None, consentimento=p.tem_consentimento,
        bot_bloqueado=p.bot_bloqueado_em is not None, posicao=posicao,
        habilitacoes=[{"etapa": h.etapa.value, "disciplina_id": h.disciplina_id,
                       "disciplina": h.disciplina.nome} for h in p.habilitacoes],
    )


@router.get("/professores", response_model=list[ProfessorOut])
def listar_professores(busca: str | None = None, db: Session = Depends(get_db)):
    lista = db.execute(select(ListaClassificacao).where(ListaClassificacao.ativa.is_(True))
                       ).scalar_one_or_none()
    q = (select(Professor, Classificacao.posicao)
         .outerjoin(Classificacao, (Classificacao.professor_id == Professor.id)
                    & (Classificacao.lista_id == (lista.id if lista else -1)))
         .options(selectinload(Professor.habilitacoes))
         .order_by(Classificacao.posicao.asc().nulls_last(), Professor.nome))
    if busca:
        termo = f"%{busca.strip()}%"
        q = q.where(or_(Professor.nome.ilike(termo), Professor.cpf == busca.strip()))
    return [professor_out(p, pos) for p, pos in db.execute(q.limit(1000)).all()]


def _aplicar_professor(db: Session, p: Professor, dados: ProfessorIn) -> None:
    if dados.cpf:
        p.cpf = dados.cpf
    p.nome, p.email = dados.nome, dados.email
    p.telefone, p.ativo, p.suspenso_ate = dados.telefone, dados.ativo, dados.suspenso_ate
    p.habilitacoes.clear()
    db.flush()
    from ..models import Habilitacao

    for h in {(h.etapa, h.disciplina_id) for h in dados.habilitacoes}:
        if db.get(Disciplina, h[1]) is None:
            raise HTTPException(422, f"Disciplina {h[1]} inexistente.")
        p.habilitacoes.append(Habilitacao(etapa=h[0], disciplina_id=h[1]))


@router.post("/professores", response_model=ProfessorOut, status_code=201)
def criar_professor(dados: ProfessorIn, request: Request, db: Session = Depends(get_db),
                    u: Usuario = Depends(exigir_admin)):
    if not dados.cpf:
        raise HTTPException(422, "CPF obrigatório.")
    p = Professor(nome=dados.nome, cpf=dados.cpf)
    db.add(p)
    _commit(db, "CPF já cadastrado.", apenas_flush=True)
    _aplicar_professor(db, p, dados)
    audit.registrar(db, "PROFESSOR_CRIADO", "professor", p.id, **_ator(u, request))
    _commit(db, "CPF já cadastrado.")
    return professor_out(p)


@router.put("/professores/{professor_id}", response_model=ProfessorOut)
def editar_professor(professor_id: int, dados: ProfessorIn, request: Request,
                     db: Session = Depends(get_db), u: Usuario = Depends(exigir_admin)):
    p = db.get(Professor, professor_id) or _404()
    _aplicar_professor(db, p, dados)
    audit.registrar(db, "PROFESSOR_EDITADO", "professor", p.id, dados={
        "ativo": dados.ativo, "suspenso_ate": dados.suspenso_ate,
        "habilitacoes": [h.model_dump(mode="json") for h in dados.habilitacoes],
    }, **_ator(u, request))
    _commit(db, "CPF já cadastrado.")
    return professor_out(p)


@router.post("/professores/{professor_id}/codigo-vinculo", response_model=CodigoVinculoOut)
def gerar_codigo_vinculo(professor_id: int, request: Request, db: Session = Depends(get_db),
                         u: Usuario = Depends(exigir_admin)):
    """Gera um código de 6 dígitos, de uso único e válido por 7 dias, para o
    professor vincular o Telegram. O código é exibido só esta vez."""
    from ..config import get_settings

    p = db.get(Professor, professor_id) or _404()
    codigo = codigo_numerico(6)
    p.codigo_vinculo_hash = sha256(f"{p.id}:{codigo}")
    p.codigo_vinculo_expira_em = agora() + timedelta(days=7)
    audit.registrar(db, "CODIGO_VINCULO_GERADO", "professor", p.id, **_ator(u, request))
    db.commit()
    bot = get_settings().telegram_bot_username
    onde = f"https://t.me/{bot}" if bot else "o bot da Secretaria no Telegram"
    return CodigoVinculoOut(
        codigo=codigo, expira_em=p.codigo_vinculo_expira_em,
        instrucoes=f"Abra {onde}, toque em Iniciar, informe o CPF e o código {codigo}.",
    )


# ------------------------------------------------------------------ listas de classificação

@router.get("/listas", response_model=list[ListaOut])
def listar_listas(db: Session = Depends(get_db)):
    return db.execute(select(ListaClassificacao).order_by(ListaClassificacao.importada_em.desc())
                      ).scalars().all()


@router.post("/listas/importar", response_model=ImportacaoOut)
async def importar_lista(request: Request, arquivo: UploadFile = File(...),
                         nome: str = Form(..., min_length=3, max_length=200),
                         edital: str | None = Form(None), ativar: bool = Form(True),
                         confirmar: bool = Form(False), db: Session = Depends(get_db),
                         u: Usuario = Depends(exigir_admin)):
    """`confirmar=false` só valida e devolve a prévia. `confirmar=true` grava
    tudo, ou nada se houver algum erro."""
    conteudo = await arquivo.read(MAX_UPLOAD + 1)
    if len(conteudo) > MAX_UPLOAD:
        raise HTTPException(413, "Arquivo maior que 5 MB.")
    try:
        res = importacao.importar(db, usuario=u, nome_arquivo=arquivo.filename or "",
                                  conteudo=conteudo, nome_lista=nome, edital=edital,
                                  ativar=ativar, confirmar=confirmar, ip=ip_de(request))
    except importacao.ArquivoInvalido as e:
        raise HTTPException(422, str(e))
    if confirmar and res.ok:
        db.commit()
    else:
        db.rollback()
    return ImportacaoOut(confirmado=confirmar and res.ok, **{
        k: getattr(res, k) for k in ("ok", "total_linhas", "professores_novos",
                                     "professores_atualizados", "disciplinas_novas",
                                     "lista_id", "previa")},
        erros=[e.__dict__ for e in res.erros[:500]], avisos=[a.__dict__ for a in res.avisos[:500]])


@router.post("/listas/{lista_id}/ativar", response_model=ListaOut)
def ativar_lista(lista_id: int, request: Request, db: Session = Depends(get_db),
                 u: Usuario = Depends(exigir_admin)):
    lista = db.get(ListaClassificacao, lista_id) or _404()
    importacao.ativar_lista(db, lista, u, ip=ip_de(request))
    db.commit()
    return lista


@router.get("/listas/{lista_id}/classificacao")
def ver_classificacao(lista_id: int, db: Session = Depends(get_db)):
    linhas = db.execute(
        select(Classificacao).where(Classificacao.lista_id == lista_id)
        .options(selectinload(Classificacao.professor).selectinload(Professor.habilitacoes))
        .order_by(Classificacao.rebaixado_em.asc().nulls_first(), Classificacao.posicao)
    ).scalars().all()
    return [{"ordem_efetiva": i + 1, "posicao": c.posicao, "rebaixado_em": c.rebaixado_em,
             "professor": professor_out(c.professor).model_dump()} for i, c in enumerate(linhas)]


# ------------------------------------------------------------------ configuração

@router.get("/configuracao", response_model=ConfiguracaoIO)
def ver_configuracao(db: Session = Depends(get_db)):
    cfg = configuracao.obter(db)
    db.commit()
    return cfg


@router.put("/configuracao", response_model=ConfiguracaoIO)
def salvar_configuracao(dados: ConfiguracaoIO, request: Request, db: Session = Depends(get_db),
                        u: Usuario = Depends(exigir_admin)):
    cfg = configuracao.obter(db)
    antes = ConfiguracaoIO.model_validate(cfg).model_dump(mode="json")
    for k, v in dados.model_dump().items():
        setattr(cfg, k, v)
    cfg.atualizada_em = agora()
    cfg.atualizada_por_id = u.id
    audit.registrar(db, "CONFIGURACAO_ALTERADA", "configuracao", 1,
                    dados={"antes": antes, "depois": dados.model_dump(mode="json")},
                    **_ator(u, request))
    db.commit()
    return cfg


# ------------------------------------------------------------------ painel geral e relatórios

def _filtradas(db, escola_id, status, inicio, fim):
    return relatorios.filtrar_solicitacoes(
        db, escola_ids=[escola_id] if escola_id else None, status=status, inicio=inicio, fim=fim,
        limite=5000)


@router.get("/painel")
def painel(escola_id: int | None = None, status: StatusSolicitacao | None = None,
           inicio: date | None = None, fim: date | None = None, db: Session = Depends(get_db)):
    sols = _filtradas(db, escola_id, status, inicio, fim)
    return {"indicadores": relatorios.indicadores(db, sols),
            "solicitacoes": [resumo(db, x) for x in sols[:300]]}


@router.get("/relatorios/solicitacoes.csv")
def exportar_solicitacoes(request: Request, escola_id: int | None = None,
                          status: StatusSolicitacao | None = None,
                          inicio: date | None = None, fim: date | None = None,
                          db: Session = Depends(get_db),
                          u: Usuario = Depends(exigir_admin)):
    sols = _filtradas(db, escola_id, status, inicio, fim)
    audit.registrar(db, "RELATORIO_EXPORTADO", "solicitacao", None, dados={
        "escola_id": escola_id, "status": status, "inicio": inicio, "fim": fim,
        "linhas": len(sols)}, **_ator(u, request))
    db.commit()
    return Response(relatorios.csv_solicitacoes(sols), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=solicitacoes.csv"})


# ------------------------------------------------------------------ auditoria

@router.get("/auditoria")
def listar_auditoria(entidade: str | None = None, entidade_id: int | None = None,
                     escola_id: int | None = None, acao: str | None = None,
                     antes_de_id: int | None = None, limite: int = Query(100, le=500),
                     db: Session = Depends(get_db)):
    q = select(LogAuditoria).order_by(LogAuditoria.id.desc()).limit(limite)
    if entidade:
        q = q.where(LogAuditoria.entidade == entidade)
    if entidade_id is not None:
        q = q.where(LogAuditoria.entidade_id == entidade_id)
    if escola_id is not None:
        q = q.where(LogAuditoria.escola_id == escola_id)
    if acao:
        q = q.where(LogAuditoria.acao == acao)
    if antes_de_id:
        q = q.where(LogAuditoria.id < antes_de_id)
    return [{"id": r.id, "ocorrido_em": r.ocorrido_em, "ator_tipo": r.ator_tipo,
             "ator_id": r.ator_id, "acao": r.acao, "entidade": r.entidade,
             "entidade_id": r.entidade_id, "escola_id": r.escola_id, "dados": r.dados,
             "ip": r.ip, "hash": r.hash} for r in db.execute(q).scalars()]


@router.get("/auditoria/verificar")
def verificar_auditoria(db: Session = Depends(get_db)):
    total = db.execute(select(func.count()).select_from(LogAuditoria)).scalar()
    res = audit.verificar_cadeia(db)
    return {**res, "registros": total}
