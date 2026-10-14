"""Mensagens padronizadas e enfileiramento no outbox.

Tudo o que precisa chegar ao destinatário passa pelo outbox, gravado NA MESMA
transação da mudança de estado. Se a transação for desfeita, a mensagem também
é. O worker faz o envio, com retry.
"""
from __future__ import annotations

from html import escape

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    ETAPA_NOMES,
    Canal,
    Convocacao,
    OutboxMensagem,
    Perfil,
    Professor,
    Solicitacao,
    Turno,
    Usuario,
)
from ..tempo import fmt_data, fmt_datahora, fmt_hora

TURNO_NOME = {Turno.MANHA: "Manhã", Turno.TARDE: "Tarde", Turno.NOITE: "Noite",
              Turno.INTEGRAL: "Integral"}


def periodo(sol: Solicitacao) -> str:
    if sol.data_inicio == sol.data_fim:
        return fmt_data(sol.data_inicio)
    return f"{fmt_data(sol.data_inicio)} a {fmt_data(sol.data_fim)}"


def resumo_vaga(sol: Solicitacao, html: bool = True) -> str:
    e = escape if html else (lambda x: x)
    linhas = [
        f"🏫 {e(sol.escola.nome)}",
        f"📅 {periodo(sol)}",
        f"🕒 {fmt_hora(sol.hora_inicio)}–{fmt_hora(sol.hora_fim)} ({TURNO_NOME[sol.turno]})",
        f"📚 {e(sol.disciplina.nome)} · {ETAPA_NOMES[sol.etapa]}",
        f"👥 Turma {e(sol.turma)}",
    ]
    if sol.observacoes:
        linhas.append(f"📝 {e(sol.observacoes)}")
    return "\n".join(linhas)


def _telegram(s: Session, prof: Professor, tipo: str, texto: str, *,
              botoes: list[list[tuple[str, str]]] | None = None,
              conv: Convocacao | None = None,
              remover_botoes_de: int | None = None) -> None:
    if prof.telegram_chat_id is None:
        return
    s.add(OutboxMensagem(
        canal=Canal.TELEGRAM,
        destino=str(prof.telegram_chat_id),
        tipo=tipo,
        payload={"texto": texto, "botoes": botoes, "remover_botoes_de": remover_botoes_de},
        convocacao_id=conv.id if conv else None,
        professor_id=prof.id,
    ))


def _email(s: Session, para: str, tipo: str, assunto: str, corpo: str) -> None:
    s.add(OutboxMensagem(canal=Canal.EMAIL, destino=para, tipo=tipo,
                         payload={"assunto": assunto, "corpo": corpo}))


def _diretores(s: Session, escola_id: int) -> list[Usuario]:
    from ..models import usuario_escola

    return list(s.execute(
        select(Usuario).join(usuario_escola, usuario_escola.c.usuario_id == Usuario.id)
        .where(usuario_escola.c.escola_id == escola_id, Usuario.ativo.is_(True))
    ).scalars())


def _admins(s: Session) -> list[Usuario]:
    return list(s.execute(
        select(Usuario).where(Usuario.perfil == Perfil.ADMIN, Usuario.ativo.is_(True))
    ).scalars())


# ---------------------------------------------------------------- professor

def convocacao(s: Session, conv: Convocacao, expira_em) -> None:
    sol = conv.solicitacao
    texto = (
        "<b>📣 Convocação para substituição</b>\n\n"
        f"{resumo_vaga(sol)}\n\n"
        f"Responda até <b>{fmt_datahora(expira_em)}</b>. "
        "A vaga fica com quem aceitar primeiro."
    )
    _telegram(s, conv.professor, "CONVOCACAO", texto, conv=conv, botoes=[[
        ("✅ Aceito", f"c:{conv.id}:a"),
        ("❌ Recuso", f"c:{conv.id}:r"),
    ]])


def vaga_preenchida(s: Session, conv: Convocacao) -> None:
    sol = conv.solicitacao
    texto = (f"ℹ️ A vaga de {escape(sol.disciplina.nome)} em {escape(sol.escola.nome)} "
             f"({periodo(sol)}) <b>já foi preenchida</b>. Obrigado pela atenção!")
    _telegram(s, conv.professor, "VAGA_PREENCHIDA", texto, remover_botoes_de=conv.id)


def aceite_confirmado(s: Session, conv: Convocacao) -> None:
    sol = conv.solicitacao
    contato = []
    if sol.escola.endereco:
        contato.append(f"📍 {escape(sol.escola.endereco)}")
    if sol.escola.telefone:
        contato.append(f"☎️ {escape(sol.escola.telefone)}")
    texto = ("<b>✅ Vaga confirmada para você!</b>\n\n" + resumo_vaga(sol)
             + ("\n" + "\n".join(contato) if contato else "")
             + "\n\nA direção da escola já foi avisada.")
    _telegram(s, conv.professor, "ACEITE_CONFIRMADO", texto, remover_botoes_de=conv.id)


def solicitacao_cancelada(s: Session, conv: Convocacao, aceita: bool) -> None:
    sol = conv.solicitacao
    if aceita:
        texto = (f"⚠️ A substituição em {escape(sol.escola.nome)} ({periodo(sol)}) que você "
                 "havia aceitado foi <b>cancelada pela escola</b>.")
    else:
        texto = (f"ℹ️ A convocação para {escape(sol.escola.nome)} ({periodo(sol)}) foi "
                 "<b>cancelada pela escola</b>. Nenhuma ação é necessária.")
    _telegram(s, conv.professor, "CANCELAMENTO", texto, remover_botoes_de=conv.id)


def solicitacao_encerrada(s: Session, conv: Convocacao) -> None:
    sol = conv.solicitacao
    texto = (f"ℹ️ A convocação para {escape(sol.escola.nome)} ({periodo(sol)}) foi "
             "encerrada. Nenhuma ação é necessária.")
    _telegram(s, conv.professor, "ENCERRAMENTO", texto, remover_botoes_de=conv.id)


# ---------------------------------------------------------------- diretor / secretaria

def diretor_preenchida(s: Session, sol: Solicitacao, prof: Professor) -> None:
    corpo = (
        f"A solicitação #{sol.id} foi preenchida.\n\n"
        f"{resumo_vaga(sol, html=False)}\n\n"
        f"Professor(a): {prof.nome}\n"
        f"Telefone: {prof.telefone or '-'}\n"
        f"E-mail: {prof.email or '-'}\n"
    )
    for d in _diretores(s, sol.escola_id):
        _email(s, d.email, "DIRETOR_PREENCHIDA",
               f"[Substituição] Vaga preenchida: {sol.disciplina.nome} {periodo(sol)}", corpo)


def fila_esgotada(s: Session, sol: Solicitacao) -> None:
    corpo = (
        f"A solicitação #{sol.id} esgotou a fila de classificação sem aceite.\n\n"
        f"{resumo_vaga(sol, html=False)}\n\n"
        "Nenhum professor habilitado e disponível aceitou a convocação. "
        "É necessária uma providência manual da Secretaria."
    )
    destinos = {u.email for u in _diretores(s, sol.escola_id)} | {u.email for u in _admins(s)}
    for email in sorted(destinos):
        _email(s, email, "FILA_ESGOTADA",
               f"[Substituição] ALERTA: fila esgotada — {sol.escola.nome}", corpo)


def diretor_expirada(s: Session, sol: Solicitacao) -> None:
    corpo = (f"A solicitação #{sol.id} foi encerrada porque o período terminou sem aceite.\n\n"
             f"{resumo_vaga(sol, html=False)}")
    for d in _diretores(s, sol.escola_id):
        _email(s, d.email, "DIRETOR_EXPIRADA",
               f"[Substituição] Solicitação expirada: {sol.disciplina.nome} {periodo(sol)}", corpo)


def recuperar_senha(s: Session, usuario: Usuario, link: str, minutos: int) -> None:
    corpo = (
        f"Olá, {usuario.nome}.\n\n"
        f"Para redefinir sua senha no Sistema de Substituições, acesse o link abaixo "
        f"(válido por {minutos} minutos):\n\n{link}\n\n"
        "Se você não pediu a redefinição, ignore este e-mail."
    )
    _email(s, usuario.email, "RECUPERAR_SENHA", "[Substituição] Redefinição de senha", corpo)
