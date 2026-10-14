"""Endpoints do diretor (e do admin), com isolamento por escola."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import checar_escola, escolas_permitidas, ip_de, solicitacao_do_usuario, usuario_atual
from ..models import (
    ETAPA_NOMES,
    Convocacao,
    Disciplina,
    Escola,
    Etapa,
    Onda,
    Solicitacao,
    StatusSolicitacao,
    Turno,
    Usuario,
)
from ..schemas import (
    CancelarIn,
    ConvocacaoOut,
    EscolaOut,
    OndaOut,
    ProfessorAceitoOut,
    PuloOut,
    SolicitacaoDetalhe,
    SolicitacaoIn,
)
from ..services import motor, relatorios
from ..services.notificacoes import TURNO_NOME

router = APIRouter(prefix="/api", tags=["solicitacoes"])


def resumo(db: Session, sol: Solicitacao) -> dict:
    onda = None
    if sol.status == StatusSolicitacao.EM_CONVOCACAO:
        onda = db.execute(select(Onda).where(Onda.solicitacao_id == sol.id,
                                             Onda.ciclo == sol.ciclo,
                                             Onda.encerrada_em.is_(None))).scalar_one_or_none()
    return {
        "id": sol.id, "escola": {"id": sol.escola.id, "nome": sol.escola.nome},
        "disciplina": sol.disciplina.nome, "etapa": sol.etapa, "turma": sol.turma,
        "turno": sol.turno, "data_inicio": sol.data_inicio, "data_fim": sol.data_fim,
        "hora_inicio": sol.hora_inicio, "hora_fim": sol.hora_fim, "urgente": sol.urgente,
        "status": sol.status, "ciclo": sol.ciclo, "criada_em": sol.criada_em,
        "preenchida_em": sol.preenchida_em,
        "professor_aceito": sol.professor_aceito.nome if sol.professor_aceito else None,
        "onda_atual": onda.numero if onda else None,
        "expira_em": onda.expira_em if onda else None,
    }


def detalhe(db: Session, sol: Solicitacao) -> SolicitacaoDetalhe:
    ondas = db.execute(
        select(Onda).where(Onda.solicitacao_id == sol.id)
        .options(selectinload(Onda.convocacoes).selectinload(Convocacao.professor),
                 selectinload(Onda.pulos))
        .order_by(Onda.ciclo.desc(), Onda.numero.desc())
    ).scalars().all()
    contato = None
    if sol.status == StatusSolicitacao.PREENCHIDA and sol.professor_aceito:
        p = sol.professor_aceito
        contato = ProfessorAceitoOut(nome=p.nome, telefone=p.telefone, email=p.email)
    return SolicitacaoDetalhe(
        **resumo(db, sol), motivo=sol.motivo, observacoes=sol.observacoes,
        timeout_minutos=sol.timeout_minutos, motivo_cancelamento=sol.motivo_cancelamento,
        encerrada_em=sol.encerrada_em, criada_por=sol.criada_por.nome,
        contato_professor=contato,
        ondas=[OndaOut(
            id=o.id, ciclo=o.ciclo, numero=o.numero, iniciada_em=o.iniciada_em,
            expira_em=o.expira_em, encerrada_em=o.encerrada_em,
            motivo_encerramento=o.motivo_encerramento,
            convocacoes=[ConvocacaoOut(
                id=c.id, professor=c.professor.nome, posicao=c.posicao, ordem=c.ordem,
                status=c.status, status_texto=relatorios.status_convocacao_texto(c.status),
                criada_em=c.criada_em, enviada_em=c.enviada_em, respondida_em=c.respondida_em,
                tempo_resposta_s=c.tempo_resposta_s) for c in o.convocacoes],
            pulos=[PuloOut(professor=p.professor.nome, posicao=p.posicao, ordem=p.ordem,
                           motivo=p.motivo, motivo_texto=relatorios.MOTIVO_PULO_TEXTO[p.motivo])
                   for p in o.pulos],
        ) for o in ondas],
    )


# ------------------------------------------------------------------ apoio ao formulário

@router.get("/escolas", response_model=list[EscolaOut])
def minhas_escolas(db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    ids = escolas_permitidas(u)
    q = select(Escola).where(Escola.ativa.is_(True)).order_by(Escola.nome)
    if ids is not None:
        q = q.where(Escola.id.in_(ids))
    return db.execute(q).scalars().all()


@router.get("/catalogo")
def catalogo(db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return {
        "disciplinas": [{"id": d.id, "nome": d.nome} for d in
                        db.execute(select(Disciplina).order_by(Disciplina.nome)).scalars()],
        "etapas": [{"id": e.value, "nome": ETAPA_NOMES[e]} for e in Etapa],
        "turnos": [{"id": t.value, "nome": TURNO_NOME[t]} for t in Turno],
    }


# ------------------------------------------------------------------ solicitações

@router.get("/solicitacoes")
def listar(status: StatusSolicitacao | None = None, escola_id: int | None = None,
           inicio: date | None = None, fim: date | None = None,
           db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    permitidas = escolas_permitidas(u)
    if escola_id is not None:
        checar_escola(u, escola_id)
        permitidas = [escola_id]
    sols = relatorios.filtrar_solicitacoes(db, escola_ids=permitidas, status=status,
                                           inicio=inicio, fim=fim, limite=300)
    return [resumo(db, x) for x in sols]


@router.post("/solicitacoes", response_model=SolicitacaoDetalhe, status_code=201)
def criar(dados: SolicitacaoIn, request: Request, db: Session = Depends(get_db),
          u: Usuario = Depends(usuario_atual)):
    checar_escola(u, dados.escola_id)
    escola = db.get(Escola, dados.escola_id)
    if escola is None or not escola.ativa:
        raise HTTPException(404, "Não encontrado")
    if db.get(Disciplina, dados.disciplina_id) is None:
        raise HTTPException(422, "Disciplina inexistente.")
    try:
        sol = motor.criar_solicitacao(db, u, **dados.model_dump(), ip=ip_de(request))
        db.commit()
    except motor.ErroNegocio as e:
        db.rollback()
        raise HTTPException(422, str(e))
    return detalhe(db, sol)


@router.get("/solicitacoes/{solicitacao_id}", response_model=SolicitacaoDetalhe)
def ver(solicitacao_id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return detalhe(db, solicitacao_do_usuario(db, u, solicitacao_id))


@router.post("/solicitacoes/{solicitacao_id}/cancelar", response_model=SolicitacaoDetalhe)
def cancelar(solicitacao_id: int, dados: CancelarIn, request: Request,
             db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    solicitacao_do_usuario(db, u, solicitacao_id)
    try:
        sol = motor.cancelar(db, solicitacao_id, u, dados.motivo, ip=ip_de(request))
        db.commit()
    except motor.ErroNegocio as e:
        db.rollback()
        raise HTTPException(409, str(e))
    return detalhe(db, sol)


@router.post("/solicitacoes/{solicitacao_id}/reabrir", response_model=SolicitacaoDetalhe)
def reabrir(solicitacao_id: int, request: Request, db: Session = Depends(get_db),
            u: Usuario = Depends(usuario_atual)):
    solicitacao_do_usuario(db, u, solicitacao_id)
    try:
        sol = motor.reabrir(db, solicitacao_id, u, ip=ip_de(request))
        db.commit()
    except motor.ErroNegocio as e:
        db.rollback()
        raise HTTPException(409, str(e))
    return detalhe(db, sol)


@router.get("/solicitacoes/{solicitacao_id}/comprovacao")
def comprovacao(solicitacao_id: int, formato: str = "json", db: Session = Depends(get_db),
                u: Usuario = Depends(usuario_atual)):
    """Relatório que comprova o respeito à ordem de classificação."""
    sol = solicitacao_do_usuario(db, u, solicitacao_id)
    rel = relatorios.comprovacao_ordem(db, sol)
    if formato == "csv":
        return Response(relatorios.csv_comprovacao(rel), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition":
                                 f"attachment; filename=comprovacao-{sol.id}.csv"})
    return rel

