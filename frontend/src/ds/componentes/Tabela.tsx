import type { ReactNode } from "react";

export interface ColunaTabela<T> {
  chave: string;
  titulo: string;
  /** Números alinham à direita e usam algarismos tabulares. */
  numerica?: boolean;
  /** Conteúdo da célula; sem ele, usa linha[chave]. */
  celula?: (linha: T) => ReactNode;
  /** Largura mínima, para a tabela rolar no celular em vez de espremer. */
  larguraMin?: number;
}

export interface PropsTabela<T> {
  /** Legenda da tabela (também nomeia a área de rolagem). */
  legenda: string;
  /** Mostrar a legenda visualmente (padrão: só para leitores de tela). */
  legendaVisivel?: boolean;
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chaveLinha: (linha: T) => string | number;
  vazio?: ReactNode;
}

/** Tabela: rola na horizontal dentro do próprio contêiner, nunca a página. */
export function Tabela<T>({ legenda, legendaVisivel, colunas, linhas, chaveLinha, vazio }: PropsTabela<T>) {
  return (
    <div className="ds-tabela-rolagem" role="region" aria-label={legenda} tabIndex={0}>
      <table className="ds-tabela">
        <caption className={legendaVisivel ? "ds-tabela-legenda" : "ds-so-leitor"}>{legenda}</caption>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" className={c.numerica ? "ds-num" : undefined} style={c.larguraMin ? { minWidth: c.larguraMin } : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={colunas.length} className="ds-tabela-vazia">{vazio ?? "Nada para mostrar."}</td>
            </tr>
          )}
          {linhas.map((l) => (
            <tr key={chaveLinha(l)}>
              {colunas.map((c) => (
                <td key={c.chave} className={c.numerica ? "ds-num" : undefined}>
                  {c.celula ? c.celula(l) : String((l as Record<string, unknown>)[c.chave] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
