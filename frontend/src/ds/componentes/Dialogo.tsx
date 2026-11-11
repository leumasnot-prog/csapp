import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconeFechar } from "../icones";
import { COM_MOVIMENTO, CURVA_SAIDA, DURACAO, gsap, useGSAP } from "../movimento";

export interface PropsDialogo {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
  /** Botões do rodapé; o primeiro da direita é a ação principal. */
  acoes?: ReactNode;
  /** Diálogo de alerta (confirmação destrutiva): role="alertdialog". */
  alerta?: boolean;
}

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal: foco preso dentro, Esc fecha, clique no fundo fecha, e o foco
 * volta para quem abriu. Renderiza em portal, dentro de uma .ds-raiz própria.
 */
export function Dialogo({ aberto, aoFechar, titulo, descricao, children, acoes, alerta }: PropsDialogo) {
  const caixa = useRef<HTMLDivElement>(null);
  const camada = useRef<HTMLDivElement>(null);
  const anterior = useRef<HTMLElement | null>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tituloId = `ds-dialogo-${base}-titulo`;
  const descricaoId = `ds-dialogo-${base}-descricao`;

  useEffect(() => {
    if (!aberto) return;
    anterior.current = document.activeElement as HTMLElement | null;
    const el = caixa.current;
    // foco inicial: primeiro campo, senão o primeiro botão de ação, senão a caixa
    const primeiro = el?.querySelector<HTMLElement>("input, select, textarea") ?? el?.querySelector<HTMLElement>(".ds-dialogo-acoes " + FOCAVEIS) ?? el;
    primeiro?.focus();
    const rolagem = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const itens = Array.from(el.querySelectorAll<HTMLElement>(FOCAVEIS)).filter((x) => x.offsetParent !== null);
      if (itens.length === 0) {
        e.preventDefault();
        return;
      }
      const ini = itens[0];
      const fim = itens[itens.length - 1];
      if (e.shiftKey && (document.activeElement === ini || document.activeElement === el)) {
        e.preventDefault();
        fim.focus();
      } else if (!e.shiftKey && document.activeElement === fim) {
        e.preventDefault();
        ini.focus();
      }
    }
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.documentElement.style.overflow = rolagem;
      anterior.current?.focus?.();
    };
  }, [aberto]);

  useGSAP(
    () => {
      if (!aberto) return;
      const mm = gsap.matchMedia();
      mm.add(COM_MOVIMENTO, () => {
        gsap.from(".ds-dialogo-veu", { opacity: 0, duration: DURACAO.rapida, ease: "none" });
        gsap.from(".ds-dialogo", { opacity: 0, y: 12, scale: 0.98, duration: DURACAO.lenta, ease: CURVA_SAIDA });
      });
      return () => mm.revert();
    },
    { dependencies: [aberto], scope: camada },
  );

  if (!aberto) return null;
  return createPortal(
    <div className="ds-raiz ds-camada" ref={camada}>
      <div className="ds-dialogo-veu" onClick={() => fechar.current()} aria-hidden="true" />
      <div
        ref={caixa}
        className="ds-dialogo"
        role={alerta ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricao ? descricaoId : undefined}
        tabIndex={-1}
      >
        <div className="ds-dialogo-topo">
          <h2 id={tituloId} className="ds-dialogo-titulo">{titulo}</h2>
          <button type="button" className="ds-dialogo-fechar" onClick={() => fechar.current()} aria-label="Fechar">
            <IconeFechar tamanho={20} />
          </button>
        </div>
        {descricao && <div id={descricaoId} className="ds-dialogo-descricao">{descricao}</div>}
        {children}
        {acoes && <div className="ds-dialogo-acoes">{acoes}</div>}
      </div>
    </div>,
    document.body,
  );
}
