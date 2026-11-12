import type { ReactNode } from "react";
import { IconeTelefone } from "../icones";
import { Selo, type EstadoSolicitacao } from "./Selo";

export interface PropsResumoSolicitacao {
  escola: string;
  disciplina: string;
  turma: string;
  /** Ex.: "Hoje, 13:00 às 14:40". */
  horario: string;
  /** Sem estado: rascunho, ainda não enviada. */
  estado?: EstadoSolicitacao;
  /** Quem aceitou. O diretor só vê o telefone de quem aceitou (LGPD). */
  substituto?: { nome: string; telefone: string };
  /** Linha quando ainda não há substituto (ex.: "Aguardando o primeiro aceite"). */
  semSubstituto?: ReactNode;
  /** Nível do título (padrão 3). */
  nivelTitulo?: 2 | 3 | 4;
  className?: string;
}

/**
 * Resumo da solicitação, como o diretor vê no acompanhamento: o que é a vaga,
 * o estado e, quando preenchida, o nome e o telefone de quem vai dar a aula.
 * A linha do substituto sempre existe, para a altura não mudar quando ele chega.
 */
export function ResumoSolicitacao({
  escola, disciplina, turma, horario, estado, substituto, semSubstituto = "Aguardando o primeiro aceite", nivelTitulo = 3, className,
}: PropsResumoSolicitacao) {
  const Titulo = `h${nivelTitulo}` as const;
  return (
    <section className={["ds-solicitacao", substituto && "ds-solicitacao--preenchida", className].filter(Boolean).join(" ")} aria-label="Solicitação">
      <div className="ds-solicitacao-cabeca">
        <Titulo className="ds-solicitacao-titulo">{disciplina}, {turma}</Titulo>
        {estado && <Selo solicitacao={estado} />}
      </div>
      <dl className="ds-solicitacao-dados">
        <div><dt>Unidade</dt><dd>{escola}</dd></div>
        <div><dt>Horário</dt><dd className="ds-num">{horario}</dd></div>
      </dl>
      <div className="ds-solicitacao-substituto" aria-live="polite">
        {substituto ? (
          <>
            <span className="ds-solicitacao-substituto-nome">{substituto.nome}</span>
            <a className="ds-solicitacao-telefone ds-num" href={`tel:${substituto.telefone.replace(/\D/g, "")}`}>
              <IconeTelefone tamanho={18} />
              {substituto.telefone}
            </a>
          </>
        ) : (
          <span className="ds-solicitacao-espera">{semSubstituto}</span>
        )}
      </div>
    </section>
  );
}
