"""Relatórios: comprovação da ordem de classificação, indicadores e exportação."""
from __future__ import annotations

import csv
import io
from collections import Counter, defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import (
    MOTIVO_PULO_TEXTO,
    Convocacao,
    Onda,
    Solicitacao,
    StatusConvocacao,
    StatusSolicitacao,
)
from ..tempo import fmt_datahora
from .notificacoes import TURNO_NOME, periodo


def comprovacao_ordem(s: Session, sol: Solicitacao, *, com_nomes: bool = True) -> dict:
    """Mostra, onda a onda, quem foi acionado, quem foi pulado (e por quê) e
    verifica se nenhuma posição à frente foi ignorada sem justificativa."""
    ondas = s.execute(
        select(Onda).where(Onda.solicitacao_id == sol.id)
        .options(selectinload(Onda.convocacoes).selectinload(Convocacao.professor),
                 selectinload(Onda.pulos))
        .order_by(Onda.ciclo, Onda.numero)
    ).scalars().all()

    ciclos: dict[int, list[dict]] = defaultdict(list)
    convocados_antes: dict[int, set[int]] = defaultdict(set)  # ciclo -> ordens já usadas
    conforme = True
    inconsistencias: list[str] = []
    for onda in ondas:
        ordens_conv = {c.ordem for c in onda.convocacoes}
        ordens_pulo = {p.ordem for p in onda.pulos}
        cobertas = ordens_conv | ordens_pulo | convocados_antes[onda.ciclo]
        maior = max(ordens_conv, default=0)
        faltando = sorted(set(range(1, maior + 1)) - cobertas)
        if faltando:
            conforme = False
            inconsistencias.append(
                f"Ciclo {onda.ciclo}, onda {onda.numero}: posições efetivas {faltando} "
                "à frente dos convocados sem registro de convocação ou de pulo "
                "(pode indicar rebaixamento 'fim da lista' ocorrido durante o processo)."
            )
        convocados_antes[onda.ciclo] |= ordens_conv
        ciclos[onda.ciclo].append({
            "onda": onda.numero,
            "iniciada_em": onda.iniciada_em,
            "expira_em": onda.expira_em,
            "encerrada_em": onda.encerrada_em,
            "motivo_encerramento": onda.motivo_encerramento,
            "convocados": [{
                "ordem": c.ordem, "posicao": c.posicao,
                "professor": c.professor.nome if com_nomes else f"#{c.professor_id}",
                "status": c.status, "enviada_em": c.enviada_em,
                "respondida_em": c.respondida_em, "tempo_resposta_s": c.tempo_resposta_s,
                "penalidade": c.penalidade_aplicada,
            } for c in onda.convocacoes],
            "pulados": [{
                "ordem": p.ordem, "posicao": p.posicao,
                "professor": p.professor.nome if com_nomes else f"#{p.professor_id}",
                "motivo": p.motivo, "motivo_texto": MOTIVO_PULO_TEXTO[p.motivo],
            } for p in onda.pulos],
        })
    return {
        "solicitacao_id": sol.id,
        "escola": sol.escola.nome,
        "vaga": f"{sol.disciplina.nome} · {sol.etapa.value} · turma {sol.turma}",
        "periodo": periodo(sol),
        "status": sol.status,
        "lista_id": sol.lista_id,
        "conforme": conforme,
        "inconsistencias": inconsistencias,
        "ciclos": [{"ciclo": c, "ondas": o} for c, o in sorted(ciclos.items())],
    }


def filtrar_solicitacoes(s: Session, *, escola_ids: list[int] | None, status=None,
                         inicio: date | None = None, fim: date | None = None,
                         limite: int = 500):
    q = select(Solicitacao).options(selectinload(Solicitacao.escola),
                                    selectinload(Solicitacao.disciplina),
                                    selectinload(Solicitacao.professor_aceito))
    if escola_ids is not None:
        q = q.where(Solicitacao.escola_id.in_(escola_ids))
    if status:
        q = q.where(Solicitacao.status == status)
    if inicio:
        q = q.where(Solicitacao.data_fim >= inicio)
    if fim:
        q = q.where(Solicitacao.data_inicio <= fim)
    return s.execute(q.order_by(Solicitacao.data_inicio.desc(), Solicitacao.id.desc())
                     .limit(limite)).scalars().all()


def indicadores(s: Session, sols: list[Solicitacao]) -> dict:
    por_status = Counter(x.status.value for x in sols)
    tempos = [(x.preenchida_em - x.criada_em).total_seconds() / 60
              for x in sols if x.preenchida_em]
    encerradas = [x for x in sols if x.status != StatusSolicitacao.EM_CONVOCACAO
                  and x.status != StatusSolicitacao.CANCELADA]
    ids = [x.id for x in sols]
    convs = s.execute(select(Convocacao.status).where(Convocacao.solicitacao_id.in_(ids))
                      ).scalars().all() if ids else []
    resp = Counter(c.value for c in convs)
    por_escola = Counter(x.escola.nome for x in sols)
    return {
        "total": len(sols),
        "por_status": dict(por_status),
        "taxa_preenchimento": round(por_status.get("PREENCHIDA", 0) / len(encerradas), 3)
        if encerradas else None,
        "tempo_medio_preenchimento_min": round(sum(tempos) / len(tempos), 1) if tempos else None,
        "convocacoes": dict(resp),
        "taxa_aceite_por_convocacao": round(resp.get("ACEITA", 0) / len(convs), 3) if convs else None,
        "por_escola": dict(por_escola.most_common()),
    }


def csv_solicitacoes(sols: list[Solicitacao]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["id", "escola", "etapa", "disciplina", "turma", "turno", "periodo", "horario",
                "urgente", "status", "ciclo", "professor_aceito", "criada_em", "preenchida_em",
                "minutos_ate_preencher"])
    for x in sols:
        minutos = (round((x.preenchida_em - x.criada_em).total_seconds() / 60, 1)
                   if x.preenchida_em else "")
        w.writerow([
            x.id, x.escola.nome, x.etapa.value, x.disciplina.nome, x.turma,
            TURNO_NOME[x.turno], periodo(x),
            f"{x.hora_inicio:%H:%M}-{x.hora_fim:%H:%M}", "sim" if x.urgente else "não",
            x.status.value, x.ciclo, x.professor_aceito.nome if x.professor_aceito else "",
            fmt_datahora(x.criada_em), fmt_datahora(x.preenchida_em) if x.preenchida_em else "",
            minutos,
        ])
    return "﻿" + buf.getvalue()  # BOM: abre certo no Excel


def csv_comprovacao(rel: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["solicitacao", "ciclo", "onda", "ordem_efetiva", "posicao_oficial", "professor",
                "situacao", "detalhe", "enviada_em", "respondida_em", "tempo_resposta_s"])
    for c in rel["ciclos"]:
        for o in c["ondas"]:
            linhas = [(p["ordem"], p["posicao"], p["professor"], "PULADO", p["motivo_texto"],
                       None, None, None) for p in o["pulados"]]
            linhas += [(v["ordem"], v["posicao"], v["professor"], "CONVOCADO", v["status"].value,
                        v["enviada_em"], v["respondida_em"], v["tempo_resposta_s"])
                       for v in o["convocados"]]
            for ordem, pos, nome, sit, det, env, resp, t in sorted(linhas, key=lambda x: x[0]):
                w.writerow([rel["solicitacao_id"], c["ciclo"], o["onda"], ordem, pos, nome, sit,
                            det, fmt_datahora(env) if env else "",
                            fmt_datahora(resp) if resp else "", t if t is not None else ""])
    return "﻿" + buf.getvalue()


def status_convocacao_texto(st: StatusConvocacao) -> str:
    return {
        StatusConvocacao.ENVIADA: "Aguardando resposta",
        StatusConvocacao.ACEITA: "Aceitou",
        StatusConvocacao.RECUSADA: "Recusou",
        StatusConvocacao.SEM_RESPOSTA: "Não respondeu",
        StatusConvocacao.VAGA_PREENCHIDA: "Vaga preenchida por outro",
        StatusConvocacao.CANCELADA: "Cancelada",
        StatusConvocacao.FALHA_ENVIO: "Falha no envio",
        StatusConvocacao.INELEGIVEL: "Conflito de agenda",
    }[st]

