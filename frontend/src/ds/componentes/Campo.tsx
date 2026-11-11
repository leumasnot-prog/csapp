import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { IconeAlerta, IconeSeta } from "../icones";

interface Base {
  rotulo: string;
  /** Texto de apoio abaixo do campo. */
  dica?: ReactNode;
  /** Mensagem de erro: diz o problema e como resolver. */
  erro?: ReactNode;
  className?: string;
}

function useCampo(id: string | undefined, dica: ReactNode, erro: ReactNode) {
  const auto = useId();
  const campoId = id ?? `ds-campo-${auto.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const dicaId = dica ? `${campoId}-dica` : undefined;
  const erroId = erro ? `${campoId}-erro` : undefined;
  const descritoPor = [erroId, dicaId].filter(Boolean).join(" ") || undefined;
  return { campoId, dicaId, erroId, descritoPor };
}

function Envoltorio({ rotulo, campoId, dica, dicaId, erro, erroId, className, obrigatorio, children }: {
  rotulo: string; campoId: string; dica?: ReactNode; dicaId?: string; erro?: ReactNode; erroId?: string; className?: string; obrigatorio?: boolean; children: ReactNode;
}) {
  return (
    <div className={["ds-campo", erro && "ds-campo--erro", className].filter(Boolean).join(" ")}>
      <label className="ds-campo-rotulo" htmlFor={campoId}>
        {rotulo}
        {obrigatorio && <span className="ds-campo-obrigatorio"> (obrigatório)</span>}
      </label>
      {children}
      {erro && (
        <p className="ds-campo-erro" id={erroId}>
          <IconeAlerta tamanho={16} />
          <span>{erro}</span>
        </p>
      )}
      {dica && <p className="ds-campo-dica" id={dicaId}>{dica}</p>}
    </div>
  );
}

export type PropsCampo = Base & InputHTMLAttributes<HTMLInputElement>;

/** Campo de texto com rótulo acima, dica e erro. */
export function Campo({ rotulo, dica, erro, className, id, required, ...resto }: PropsCampo) {
  const c = useCampo(id, dica, erro);
  return (
    <Envoltorio rotulo={rotulo} campoId={c.campoId} dica={dica} dicaId={c.dicaId} erro={erro} erroId={c.erroId} className={className} obrigatorio={required}>
      <input id={c.campoId} className="ds-controle" aria-invalid={erro ? true : undefined} aria-describedby={c.descritoPor} required={required} {...resto} />
    </Envoltorio>
  );
}

export type PropsSelecao = Base & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode };

/** Seleção nativa (melhor no celular), com a seta do conjunto de ícones. */
export function Selecao({ rotulo, dica, erro, className, id, required, children, ...resto }: PropsSelecao) {
  const c = useCampo(id, dica, erro);
  return (
    <Envoltorio rotulo={rotulo} campoId={c.campoId} dica={dica} dicaId={c.dicaId} erro={erro} erroId={c.erroId} className={className} obrigatorio={required}>
      <div className="ds-selecao">
        <select id={c.campoId} className="ds-controle" aria-invalid={erro ? true : undefined} aria-describedby={c.descritoPor} required={required} {...resto}>
          {children}
        </select>
        <IconeSeta className="ds-selecao-seta" tamanho={20} />
      </div>
    </Envoltorio>
  );
}

export type PropsAreaTexto = Base & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function AreaTexto({ rotulo, dica, erro, className, id, required, rows = 4, ...resto }: PropsAreaTexto) {
  const c = useCampo(id, dica, erro);
  return (
    <Envoltorio rotulo={rotulo} campoId={c.campoId} dica={dica} dicaId={c.dicaId} erro={erro} erroId={c.erroId} className={className} obrigatorio={required}>
      <textarea id={c.campoId} rows={rows} className="ds-controle ds-controle--area" aria-invalid={erro ? true : undefined} aria-describedby={c.descritoPor} required={required} {...resto} />
    </Envoltorio>
  );
}
