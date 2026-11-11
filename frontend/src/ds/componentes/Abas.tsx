import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface OpcaoAba<V extends string> {
  valor: V;
  rotulo: ReactNode;
  /** Número ao lado do rótulo (ex.: quantas solicitações em cada filtro). */
  contagem?: number;
}

export interface PropsAbas<V extends string> {
  /** Nome do grupo, lido por leitores de tela. */
  rotulo: string;
  opcoes: OpcaoAba<V>[];
  valor: V;
  aoMudar: (v: V) => void;
  className?: string;
}

/**
 * Grupo de pílulas para filtrar ou escolher uma opção (semântica de rádio):
 * Tab entra no grupo, setas trocam a opção, Home/End vão às pontas.
 */
export function Abas<V extends string>({ rotulo, opcoes, valor, aoMudar, className }: PropsAbas<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const i = opcoes.findIndex((o) => o.valor === valor);
    let j = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % opcoes.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + opcoes.length) % opcoes.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = opcoes.length - 1;
    else return;
    e.preventDefault();
    aoMudar(opcoes[j].valor);
    refs.current[j]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={rotulo} className={["ds-abas", className].filter(Boolean).join(" ")} onKeyDown={teclado}>
      {opcoes.map((o, i) => {
        const ativa = o.valor === valor;
        return (
          <button
            key={o.valor}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={ativa}
            tabIndex={ativa ? 0 : -1}
            className={ativa ? "ds-aba ds-aba--ativa" : "ds-aba"}
            onClick={() => aoMudar(o.valor)}
          >
            {o.rotulo}
            {o.contagem !== undefined && <span className="ds-aba-contagem">{o.contagem}</span>}
          </button>
        );
      })}
    </div>
  );
}
