// Diálogos da própria página (substituem confirm/prompt do navegador, que nem
// sempre estão disponíveis e não combinam com o restante da interface).
import { useEffect, useRef, useState } from "react";

interface Pedido {
  titulo: string;
  texto?: string;
  campo?: string; // rótulo de um campo de texto opcional
  conteudo?: string; // texto somente leitura (ex.: CSV) com botão de copiar
  ok?: string;
  perigo?: boolean;
  soFechar?: boolean;
  resolver: (v: string | boolean | null) => void;
}

let abrir: ((p: Pedido) => void) | null = null;

function pedir(p: Omit<Pedido, "resolver">) {
  return new Promise<string | boolean | null>((resolver) => {
    if (!abrir) return resolver(null);
    abrir({ ...p, resolver });
  });
}

export const confirmar = (titulo: string, texto?: string, opcoes: { ok?: string; perigo?: boolean } = {}) =>
  pedir({ titulo, texto, ...opcoes }).then((v) => v !== null && v !== false);

/** Devolve o texto digitado ("" se vazio) ou null se cancelou. */
export const perguntar = (titulo: string, campo: string, opcoes: { texto?: string; ok?: string; perigo?: boolean } = {}) =>
  pedir({ titulo, campo, ...opcoes }).then((v) => (typeof v === "string" ? v : null));

export const mostrarTexto = (titulo: string, conteudo: string, texto?: string) =>
  pedir({ titulo, conteudo, texto, soFechar: true }).then(() => undefined);

export function Dialogos() {
  const [p, setP] = useState<Pedido | null>(null);
  const [valor, setValor] = useState("");
  const [copiado, setCopiado] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    abrir = (novo) => {
      setValor("");
      setCopiado(false);
      setP(novo);
    };
    return () => {
      abrir = null;
    };
  }, []);

  useEffect(() => {
    if (!p) return;
    campoRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  if (!p) return null;

  function fechar(v: string | boolean | null) {
    p!.resolver(v);
    setP(null);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(p!.conteudo ?? "");
      setCopiado(true);
    } catch {
      areaRef.current?.select();
    }
  }

  return (
    <div className="dialogo-fundo" onClick={() => fechar(null)}>
      <form
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-titulo"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          fechar(p.campo !== undefined ? valor : true);
        }}
      >
        <h2 id="dlg-titulo">{p.titulo}</h2>
        {p.texto && <p>{p.texto}</p>}
        {p.campo !== undefined && (
          <div className="campo">
            <label htmlFor="dlg-campo">{p.campo}</label>
            <input id="dlg-campo" ref={campoRef} value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
        )}
        {p.conteudo !== undefined && (
          <textarea id="dlg-conteudo" ref={areaRef} className="dialogo-conteudo" readOnly value={p.conteudo} />
        )}
        <div className="linha" style={{ justifyContent: "flex-end" }}>
          {p.conteudo !== undefined && (
            <button type="button" className="secundario" onClick={copiar}>{copiado ? "Copiado" : "Copiar"}</button>
          )}
          {!p.soFechar && <button type="button" className="secundario" onClick={() => fechar(null)}>Voltar</button>}
          <button className={p.perigo ? "perigo" : ""}>{p.soFechar ? "Fechar" : p.ok ?? "Confirmar"}</button>
        </div>
      </form>
    </div>
  );
}
