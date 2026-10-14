"""Processamento de updates do Telegram.

Todo update é processado numa transação. As respostas imediatas ao usuário
(texto, toast do botão, edição da mensagem) só são enviadas DEPOIS do commit,
como "melhor esforço". O que precisa ser garantido (convocações, avisos) já
foi para o outbox dentro da transação.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from html import escape

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit, messaging
from ..db import transacao
from ..messaging.base import Botoes, ErroEnvio
from ..models import (
    BotSessao,
    Classificacao,
    Convocacao,
    Indisponibilidade,
    ListaClassificacao,
    Professor,
    ResultadoResposta,
    Solicitacao,
    StatusConvocacao,
    StatusSolicitacao,
    TipoResposta,
)
from ..security import iguais, sha256
from ..services import motor
from ..services.cpf import cpf_valido, somente_digitos
from ..services.notificacoes import periodo, resumo_vaga
from ..tempo import agora, fmt_data, hoje

log = logging.getLogger("bot")

MAX_TENTATIVAS_VINCULO = 5
JANELA_TENTATIVAS = timedelta(hours=1)

AJUDA = (
    "<b>Comandos disponíveis</b>\n"
    "/status — sua situação e convocações abertas\n"
    "/minhas — suas substituições\n"
    "/indisponivel 20/10 25/10 [motivo] — marcar indisponibilidade\n"
    "/privacidade — como usamos seus dados\n"
    "/sair — desvincular e revogar o consentimento"
)

TERMO_LGPD = (
    "<b>🔒 Consentimento para contato</b>\n\n"
    "A Secretaria Municipal de Educação usará este chat <b>apenas</b> para enviar "
    "convocações de substituição e avisos relacionados, conforme a ordem de "
    "classificação do processo seletivo.\n\n"
    "Dados tratados: nome, CPF, telefone, e-mail, identificador do Telegram e suas "
    "respostas às convocações (registradas para auditoria).\n\n"
    "Você pode revogar a qualquer momento com /sair. Sem o consentimento você "
    "<b>não</b> receberá convocações pelo bot.\n\n"
    "Você concorda?"
)


@dataclass
class Saida:
    mensagens: list[tuple[int, str, Botoes | None]] = field(default_factory=list)
    callback: tuple[str, str] | None = None
    editar: tuple[int, int, str] | None = None

    def texto(self, chat_id: int, texto: str, botoes: Botoes | None = None) -> None:
        self.mensagens.append((chat_id, texto, botoes))


# ---------------------------------------------------------------- entrada

def processar_update(update: dict) -> Saida:
    saida = Saida()
    try:
        with transacao() as s:
            if "callback_query" in update:
                _callback(s, update["callback_query"], saida)
            elif "message" in update:
                _mensagem(s, update["message"], saida)
    except motor.ErroNegocio as e:
        cq = update.get("callback_query")
        if cq:
            saida.callback = (cq["id"], str(e))
    _executar(saida)
    return saida


def _executar(saida: Saida) -> None:
    bot = messaging.mensageiro()
    try:
        if saida.callback:
            bot.responder_callback(*saida.callback)
        if saida.editar:
            bot.editar(*saida.editar)
        for chat_id, texto, botoes in saida.mensagens:
            bot.enviar(chat_id, texto, botoes)
    except ErroEnvio as e:
        log.warning("resposta imediata do bot falhou: %s", e)


def _professor_por_chat(s: Session, chat_id: int) -> Professor | None:
    return s.execute(select(Professor).where(Professor.telegram_chat_id == chat_id)
                     ).scalar_one_or_none()


def _sessao(s: Session, chat_id: int) -> BotSessao:
    sess = s.get(BotSessao, chat_id, with_for_update=True)
    if sess is None:
        sess = BotSessao(chat_id=chat_id, estado="", dados={}, tentativas_vinculo=0)
        s.add(sess)
    return sess


# ---------------------------------------------------------------- mensagens de texto

def _mensagem(s: Session, msg: dict, saida: Saida) -> None:
    chat = msg.get("chat", {})
    if chat.get("type") != "private":
        return
    chat_id = chat["id"]
    texto = (msg.get("text") or "").strip()
    prof = _professor_por_chat(s, chat_id)
    if prof is not None and prof.bot_bloqueado_em is not None:
        prof.bot_bloqueado_em = None  # voltou a falar com o bot
        audit.registrar(s, "BOT_DESBLOQUEADO", "professor", prof.id, ator_tipo="PROFESSOR",
                        ator_id=prof.id)

    comando, _, args = texto.partition(" ")
    comando = comando.split("@")[0].lower()

    if comando == "/vincular":
        partes = args.split()
        if len(partes) != 2:
            saida.texto(chat_id, "Use: /vincular CPF CÓDIGO")
            return
        _tentar_vincular(s, chat_id, partes[0], partes[1], saida)
        return

    if prof is None:
        sess = _sessao(s, chat_id)
        if comando == "/start" or sess.estado == "":
            sess.estado = "AGUARDANDO_CPF"
            sess.dados = {}
            saida.texto(chat_id, "👋 Olá! Este é o canal de convocações para substituição da "
                                 "Secretaria Municipal de Educação.\n\n"
                                 "Para vincular seu cadastro, digite seu <b>CPF</b> "
                                 "(somente números).")
        elif sess.estado == "AGUARDANDO_CPF":
            cpf = somente_digitos(texto)
            if not cpf_valido(cpf):
                saida.texto(chat_id, "CPF inválido. Digite os 11 números do seu CPF.")
                return
            sess.estado = "AGUARDANDO_CODIGO"
            sess.dados = {"cpf": cpf}
            saida.texto(chat_id, "Agora digite o <b>código de vínculo</b> de 6 dígitos "
                                 "fornecido pela Secretaria.")
        elif sess.estado == "AGUARDANDO_CODIGO":
            _tentar_vincular(s, chat_id, sess.dados.get("cpf", ""), texto, saida)
        sess.atualizado_em = agora()
        return

    if not prof.tem_consentimento:
        saida.texto(chat_id, TERMO_LGPD, [[("✅ Concordo", "lgpd:s"), ("Não concordo", "lgpd:n")]])
        return

    if comando in ("/start", "/ajuda", "/help", "/menu"):
        saida.texto(chat_id, f"Olá, {escape(prof.nome.split()[0])}! Você está vinculado(a) "
                             "e receberá as convocações por aqui.\n\n" + AJUDA)
    elif comando == "/status":
        _status(s, prof, chat_id, saida)
    elif comando == "/minhas":
        _minhas(s, prof, chat_id, saida)
    elif comando in ("/indisponivel", "/indisponível"):
        _indisponivel(s, prof, chat_id, args, saida)
    elif comando == "/privacidade":
        saida.texto(chat_id, TERMO_LGPD.rsplit("\n\n", 1)[0])
    elif comando == "/sair":
        saida.texto(chat_id, "Tem certeza? Você deixará de receber convocações pelo bot.",
                    [[("Sim, desvincular", "sair:s"), ("Cancelar", "sair:n")]])
    else:
        saida.texto(chat_id, AJUDA)


def _tentar_vincular(s: Session, chat_id: int, cpf: str, codigo: str, saida: Saida) -> None:
    sess = _sessao(s, chat_id)
    agora_ = agora()
    if (sess.janela_tentativas_inicio is None
            or agora_ - sess.janela_tentativas_inicio > JANELA_TENTATIVAS):
        sess.janela_tentativas_inicio = agora_
        sess.tentativas_vinculo = 0
    if sess.tentativas_vinculo >= MAX_TENTATIVAS_VINCULO:
        saida.texto(chat_id, "Muitas tentativas. Aguarde 1 hora e tente novamente.")
        return
    sess.tentativas_vinculo += 1

    cpf = somente_digitos(cpf)
    codigo = somente_digitos(codigo)
    prof = s.execute(select(Professor).where(Professor.cpf == cpf).with_for_update()
                     ).scalar_one_or_none()
    ok = (
        prof is not None and prof.ativo and prof.codigo_vinculo_hash is not None
        and prof.codigo_vinculo_expira_em is not None
        and prof.codigo_vinculo_expira_em > agora_
        and iguais(prof.codigo_vinculo_hash, sha256(f"{prof.id}:{codigo}"))
    )
    if not ok:
        sess.estado = "AGUARDANDO_CPF"
        sess.dados = {}
        audit.registrar(s, "VINCULO_FALHOU", "bot", None, dados={"chat_id": chat_id})
        saida.texto(chat_id, "CPF ou código incorreto, ou código expirado. Digite seu CPF "
                             "novamente ou procure a Secretaria para um novo código.")
        return

    anterior = _professor_por_chat(s, chat_id)
    if anterior is not None and anterior.id != prof.id:
        anterior.telegram_chat_id = None
        anterior.vinculado_em = None
        s.flush()
    prof.telegram_chat_id = chat_id
    prof.vinculado_em = agora_
    prof.bot_bloqueado_em = None
    prof.codigo_vinculo_hash = None  # uso único
    prof.codigo_vinculo_expira_em = None
    sess.estado = ""
    sess.dados = {}
    sess.tentativas_vinculo = 0
    audit.registrar(s, "BOT_VINCULADO", "professor", prof.id, ator_tipo="PROFESSOR",
                    ator_id=prof.id, dados={"chat_id": chat_id})
    saida.texto(chat_id, f"✅ Cadastro encontrado: <b>{escape(prof.nome)}</b>.")
    saida.texto(chat_id, TERMO_LGPD, [[("✅ Concordo", "lgpd:s"), ("Não concordo", "lgpd:n")]])


def _status(s: Session, prof: Professor, chat_id: int, saida: Saida) -> None:
    linhas = [f"<b>{escape(prof.nome)}</b>"]
    classif = s.execute(
        select(Classificacao).join(ListaClassificacao)
        .where(ListaClassificacao.ativa.is_(True), Classificacao.professor_id == prof.id)
    ).scalar_one_or_none()
    if classif:
        extra = " (movido para o fim da lista)" if classif.rebaixado_em else ""
        linhas.append(f"📋 Classificação: {classif.posicao}º{extra}")
    else:
        linhas.append("📋 Você não consta na lista de classificação ativa.")
    if prof.suspenso_ate and prof.suspenso_ate >= hoje():
        linhas.append(f"⛔ Suspenso até {fmt_data(prof.suspenso_ate)}")
    habs = ", ".join(sorted(f"{h.etapa.value}/{h.disciplina.nome}" for h in prof.habilitacoes))
    linhas.append(f"🎓 Habilitações: {escape(habs) or '-'}")

    abertas = s.execute(
        select(Convocacao).join(Solicitacao, Solicitacao.id == Convocacao.solicitacao_id)
        .where(Convocacao.professor_id == prof.id,
               Convocacao.ciclo == Solicitacao.ciclo,
               Convocacao.status.in_((StatusConvocacao.ENVIADA, StatusConvocacao.SEM_RESPOSTA)),
               Solicitacao.status == StatusSolicitacao.EM_CONVOCACAO)
    ).scalars().all()
    linhas.append(f"📣 Convocações abertas: {len(abertas)}")

    inds = s.execute(
        select(Indisponibilidade).where(Indisponibilidade.professor_id == prof.id,
                                        Indisponibilidade.data_fim >= hoje())
        .order_by(Indisponibilidade.data_inicio)
    ).scalars().all()
    botoes: Botoes = []
    if inds:
        linhas.append("\n<b>Indisponibilidades</b>")
        for ind in inds:
            linhas.append(f"• {fmt_data(ind.data_inicio)} a {fmt_data(ind.data_fim)}"
                          + (f" — {escape(ind.motivo)}" if ind.motivo else ""))
            botoes.append([(f"Remover {fmt_data(ind.data_inicio)}–{fmt_data(ind.data_fim)}",
                            f"ind:x:{ind.id}")])
    saida.texto(chat_id, "\n".join(linhas), botoes or None)
    for conv in abertas:
        saida.texto(chat_id, "<b>Convocação aberta</b>\n\n" + resumo_vaga(conv.solicitacao),
                    [[("✅ Aceito", f"c:{conv.id}:a"), ("❌ Recuso", f"c:{conv.id}:r")]])


def _minhas(s: Session, prof: Professor, chat_id: int, saida: Saida) -> None:
    convs = s.execute(
        select(Convocacao).join(Solicitacao, Solicitacao.id == Convocacao.solicitacao_id)
        .where(Convocacao.professor_id == prof.id, Convocacao.status == StatusConvocacao.ACEITA,
               Convocacao.ciclo == Solicitacao.ciclo,
               Solicitacao.status == StatusSolicitacao.PREENCHIDA)
        .order_by(Solicitacao.data_inicio.desc()).limit(10)
    ).scalars().all()
    if not convs:
        saida.texto(chat_id, "Você ainda não tem substituições registradas.")
        return
    linhas = ["<b>Suas substituições (últimas 10)</b>"]
    for c in convs:
        sol = c.solicitacao
        marca = "🟢" if sol.data_fim >= hoje() else "⚪"
        linhas.append(f"{marca} {periodo(sol)} — {escape(sol.escola.nome)} — "
                      f"{escape(sol.disciplina.nome)} ({escape(sol.turma)})")
    saida.texto(chat_id, "\n".join(linhas))


_DATA = re.compile(r"^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?$")


def _data(txt: str) -> date | None:
    m = _DATA.match(txt)
    if not m:
        return None
    dia, mes, ano = int(m[1]), int(m[2]), m[3]
    base = hoje()
    try:
        if ano:
            a = int(ano)
            return date(a + 2000 if a < 100 else a, mes, dia)
        d = date(base.year, mes, dia)
        return d if d >= base else date(base.year + 1, mes, dia)
    except ValueError:
        return None


def _indisponivel(s: Session, prof: Professor, chat_id: int, args: str, saida: Saida) -> None:
    partes = args.split()
    if not partes:
        saida.texto(chat_id, "Use: <code>/indisponivel 20/10 25/10 motivo opcional</code>\n"
                             "Para um único dia: <code>/indisponivel 20/10</code>\n"
                             "Veja e remova as atuais em /status.")
        return
    inicio = _data(partes[0])
    fim = _data(partes[1]) if len(partes) > 1 else None
    resto = partes[2:] if fim else partes[1:]
    fim = fim or inicio
    if inicio is None:
        saida.texto(chat_id, "Data inválida. Use o formato DD/MM ou DD/MM/AAAA.")
        return
    if fim < inicio or inicio < hoje() or (fim - inicio).days > 366:
        saida.texto(chat_id, "Período inválido (deve começar hoje ou depois e durar até 1 ano).")
        return
    motivo = " ".join(resto)[:300] or None
    ind = Indisponibilidade(professor_id=prof.id, data_inicio=inicio, data_fim=fim,
                            motivo=motivo, origem="BOT")
    s.add(ind)
    s.flush()
    audit.registrar(s, "INDISPONIBILIDADE_CRIADA", "indisponibilidade", ind.id,
                    ator_tipo="PROFESSOR", ator_id=prof.id,
                    dados={"inicio": inicio, "fim": fim})
    saida.texto(chat_id, f"✅ Indisponibilidade registrada: {fmt_data(inicio)} a "
                         f"{fmt_data(fim)}. Você não será convocado(a) nesse período.")


# ---------------------------------------------------------------- botões

def _callback(s: Session, cq: dict, saida: Saida) -> None:
    dados = cq.get("data") or ""
    chat_id = cq["from"]["id"]
    msg = cq.get("message") or {}
    message_id = msg.get("message_id")
    prof = _professor_por_chat(s, chat_id)
    if prof is None:
        saida.callback = (cq["id"], "Cadastro não vinculado. Envie /start.")
        return

    if dados.startswith("lgpd:"):
        if dados == "lgpd:s":
            prof.consentimento_em = agora()
            prof.consentimento_revogado_em = None
            audit.registrar(s, "CONSENTIMENTO_CONCEDIDO", "professor", prof.id,
                            ator_tipo="PROFESSOR", ator_id=prof.id)
            saida.callback = (cq["id"], "Obrigado!")
            if message_id:
                saida.editar = (chat_id, message_id, "✅ Consentimento registrado.")
            saida.texto(chat_id, "Tudo pronto! Você receberá as convocações por aqui.\n\n" + AJUDA)
        else:
            _desvincular(s, prof, "CONSENTIMENTO_RECUSADO")
            saida.callback = (cq["id"], "Entendido.")
            if message_id:
                saida.editar = (chat_id, message_id, "Consentimento não concedido.")
            saida.texto(chat_id, "Seu vínculo foi desfeito e você não receberá convocações "
                                 "pelo bot. Se mudar de ideia, envie /start.")
        return

    if not prof.tem_consentimento:
        saida.callback = (cq["id"], "É preciso aceitar o termo de consentimento primeiro.")
        return

    if dados.startswith("c:"):
        try:
            _, conv_id, acao = dados.split(":")
            tipo = TipoResposta.ACEITE if acao == "a" else TipoResposta.RECUSA
            conv_id = int(conv_id)
        except ValueError:
            saida.callback = (cq["id"], "Botão inválido.")
            return
        r = motor.responder(s, conv_id, prof.id, tipo)
        saida.callback = (cq["id"], r.mensagem)
        if message_id and r.resultado != ResultadoResposta.JA_RESPONDIDA:
            conv = s.get(Convocacao, conv_id)
            rodape = {
                ResultadoResposta.VAGA_CONCEDIDA: "✅ <b>Você aceitou. Vaga confirmada!</b>",
                ResultadoResposta.RECUSA_REGISTRADA: "❌ <b>Você recusou.</b>",
            }.get(r.resultado, f"ℹ️ {escape(r.mensagem)}")
            saida.editar = (chat_id, message_id, f"{resumo_vaga(conv.solicitacao)}\n\n{rodape}")
    elif dados.startswith("ind:x:"):
        ind = s.get(Indisponibilidade, int(dados.split(":")[2]))
        if ind is None or ind.professor_id != prof.id:
            saida.callback = (cq["id"], "Não encontrada.")
            return
        audit.registrar(s, "INDISPONIBILIDADE_REMOVIDA", "indisponibilidade", ind.id,
                        ator_tipo="PROFESSOR", ator_id=prof.id,
                        dados={"inicio": ind.data_inicio, "fim": ind.data_fim})
        s.delete(ind)
        saida.callback = (cq["id"], "Indisponibilidade removida.")
    elif dados == "sair:s":
        _desvincular(s, prof, "CONSENTIMENTO_REVOGADO")
        saida.callback = (cq["id"], "Desvinculado.")
        saida.texto(chat_id, "Você foi desvinculado(a) e não receberá mais convocações. "
                             "Para voltar, envie /start (será necessário um novo código).")
    elif dados == "sair:n":
        saida.callback = (cq["id"], "Ok, nada foi alterado.")
    else:
        saida.callback = (cq["id"], "Opção desconhecida.")


def _desvincular(s: Session, prof: Professor, acao: str) -> None:
    prof.consentimento_revogado_em = agora() if prof.consentimento_em else None
    prof.telegram_chat_id = None
    prof.vinculado_em = None
    audit.registrar(s, acao, "professor", prof.id, ator_tipo="PROFESSOR", ator_id=prof.id)
