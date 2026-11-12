import type { ReactNode } from "react";
import { Selo, type EstadoConvocacao } from "./Selo";

export interface ItemRegistro {
  /** Posição na lista de classificação. */
  posicao: number;
  nome: string;
  /** Resultado. Sem ele, a linha mostra só a posição na fila (ainda não chamado). */
  estado?: EstadoConvocacao;
  /** Apoio: onda, horário, motivo do pulo. */
  detalhe?: ReactNode;
}

export interface PropsRegistro {
  titulo: string;
  /** Linha de apoio abaixo do título. */
  descricao?: ReactNode;
  itens: ItemRegistro[];
  /** Nível do título (padrão 3). */
  nivelTitulo?: 2 | 3 | 4;
  className?: string;
}

/**
 * Lista de registros: a fila na ordem da classificação, com o que aconteceu
 * com cada professor. Sem estados, é a fila antes da convocação; com estados,
 * é a prova de que a ordem foi seguida.
 */
export function Registro({ titulo, descricao, itens, nivelTitulo = 3, className }: PropsRegistro) {
  const Titulo = `h${nivelTitulo}` as const;
  return (
    <section className={["ds-registro", className].filter(Boolean).join(" ")} aria-label={titulo}>
      <div className="ds-registro-cabeca">
        <Titulo className="ds-registro-titulo">{titulo}</Titulo>
        {descricao && <p className="ds-registro-descricao">{descricao}</p>}
      </div>
      <ol className="ds-registro-lista">
        {itens.map((i) => (
          <li key={`${i.posicao}-${i.nome}`} className={`ds-registro-item${i.estado ? ` ds-registro-item--${i.estado}` : ""}`}>
            <span className="ds-registro-posicao">
              <span aria-hidden="true">{i.posicao}º</span>
              <span className="ds-so-leitor">{i.posicao}º na classificação:</span>
            </span>
            <span className="ds-registro-textos">
              <span className="ds-registro-nome">{i.nome}</span>
              {i.detalhe && <span className="ds-registro-detalhe">{i.detalhe}</span>}
            </span>
            {i.estado && (
              <span className="ds-registro-estado">
                <Selo convocacao={i.estado} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
