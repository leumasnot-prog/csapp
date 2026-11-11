import { useRef } from "react";
import { IconeAceite } from "../icones";
import { COM_MOVIMENTO, CURVA_SAIDA, DURACAO, gsap, useGSAP } from "../movimento";
import { Selo, type EstadoConvocacao } from "./Selo";

type Instante = number | string | Date;

export interface ConvocadoOnda {
  /** Posição na lista de classificação. */
  posicao: number;
  nome: string;
  estado: EstadoConvocacao;
  /** Linha de apoio: horário do envio ou da resposta. */
  detalhe?: string;
}

export interface PuladoOnda {
  posicao: number;
  nome: string;
  /** Por que foi pulado (fica registrado). */
  motivo: string;
}

export interface PropsOnda {
  numero: number;
  /** Quando a onda saiu: início do prazo. */
  enviadaEm: Instante;
  /** Fim do prazo para responder. */
  prazoAte: Instante;
  /** Relógio de referência; quem usa o componente decide se ele anda. */
  agora: Instante;
  convocados: ConvocadoOnda[];
  pulados?: PuladoOnda[];
  /** Do que é a vaga (ex.: "Matemática, 7º A, tarde"). */
  contexto?: string;
  urgente?: boolean;
  /** Horário do aceite, mostrado no lugar do prazo quando a vaga é preenchida. */
  aceiteEm?: Instante;
  /** Mude este número para repetir a animação de entrada. */
  repetir?: number;
  /** Nível do título (padrão 3). */
  nivelTitulo?: 2 | 3 | 4;
  className?: string;
}

const ms = (i: Instante) => (i instanceof Date ? i.getTime() : typeof i === "string" ? Date.parse(i) : i);

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export const formatarHora = (i: Instante) => HORA.format(new Date(ms(i)));

function relogio(restanteMs: number) {
  const s = Math.ceil(restanteMs / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${String(m).padStart(2, "0")}:${ss}`;
}

function porExtenso(restanteMs: number) {
  const s = Math.ceil(restanteMs / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const partes = [];
  if (m) partes.push(`${m} ${m === 1 ? "minuto" : "minutos"}`);
  if (r || !m) partes.push(`${r} ${r === 1 ? "segundo" : "segundos"}`);
  return partes.join(" e ");
}

/** Anel de contagem: o arco laranja é o tempo que ainda resta. */
function Anel({ fracao, estado, texto }: { fracao: number; estado: "correndo" | "aceita" | "encerrada"; texto: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const cheio = estado === "aceita" ? 1 : estado === "encerrada" ? 0 : fracao;
  return (
    <div className={`ds-onda-anel ds-onda-anel--${estado}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle className="ds-onda-anel-trilho" cx="32" cy="32" r={r} />
        <circle
          className="ds-onda-anel-arco"
          cx="32"
          cy="32"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - cheio)}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="ds-onda-anel-centro">{estado === "aceita" ? <IconeAceite tamanho={26} /> : texto}</span>
    </div>
  );
}

/**
 * Onda: a peça de assinatura. Número da onda, prazo com anel de contagem e a
 * fila de professores chamados ao mesmo tempo. Quando alguém aceita, a linha
 * dele ganha o destaque verde e as outras recuam.
 */
export function Onda({
  numero, enviadaEm, prazoAte, agora, convocados, pulados = [], contexto, urgente, aceiteEm, repetir = 0, nivelTitulo = 3, className,
}: PropsOnda) {
  const raiz = useRef<HTMLElement>(null);
  const indiceAceito = convocados.findIndex((c) => c.estado === "aceitou");
  const aceitoAntes = useRef(indiceAceito);

  const total = Math.max(1, ms(prazoAte) - ms(enviadaEm));
  const restante = Math.max(0, ms(prazoAte) - ms(agora));
  const encerrada = indiceAceito < 0 && (restante === 0 || convocados.every((c) => c.estado !== "aguardando"));
  const estadoAnel = indiceAceito >= 0 ? "aceita" : encerrada ? "encerrada" : "correndo";
  const Titulo = `h${nivelTitulo}` as const;

  let legendaPrazo: string;
  let textoAnel: string;
  let leitor: string;
  if (estadoAnel === "aceita") {
    legendaPrazo = aceiteEm ? `Aceite às ${formatarHora(aceiteEm)}` : "Vaga preenchida";
    textoAnel = "";
    leitor = `Vaga preenchida por ${convocados[indiceAceito].nome}.`;
  } else if (estadoAnel === "encerrada") {
    legendaPrazo = "Onda encerrada";
    textoAnel = "00:00";
    leitor = "Prazo encerrado.";
  } else {
    legendaPrazo = `Prazo até ${formatarHora(prazoAte)}`;
    textoAnel = relogio(restante);
    leitor = `Restam ${porExtenso(restante)} para responder.`;
  }

  // Entrada: a onda nova chega (cabeçalho, anel e linhas em sequência curta).
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(COM_MOVIMENTO, () => {
        const tl = gsap.timeline({ defaults: { ease: CURVA_SAIDA } });
        tl.from(".ds-onda-cabeca", { opacity: 0, y: 8, duration: DURACAO.media })
          .from(".ds-onda-anel", { opacity: 0, scale: 0.86, duration: DURACAO.lenta }, "<0.04")
          .from(".ds-onda-linha", { opacity: 0, y: 14, duration: DURACAO.lenta, stagger: 0.06 }, "<0.06");
      });
      return () => mm.revert();
    },
    { dependencies: [repetir, numero], scope: raiz, revertOnUpdate: true },
  );

  // Aceite: o destaque verde varre a linha e as outras recuam.
  useGSAP(
    () => {
      const mudou = aceitoAntes.current !== indiceAceito;
      aceitoAntes.current = indiceAceito;
      if (!mudou || indiceAceito < 0) return;
      const mm = gsap.matchMedia();
      mm.add(COM_MOVIMENTO, () => {
        const tl = gsap.timeline({ defaults: { ease: CURVA_SAIDA } });
        tl.from(".ds-onda-linha--aceita .ds-onda-realce", { scaleX: 0, transformOrigin: "0% 50%", duration: DURACAO.lenta })
          .from(".ds-onda-linha--aceita .ds-onda-posicao", { scale: 0.8, duration: DURACAO.media }, "<")
          .from(".ds-onda-linha--aceita .ds-selo", { opacity: 0, x: -6, duration: DURACAO.media }, "<0.05")
          .from(".ds-onda-linha--recuada :is(.ds-onda-nome, .ds-onda-posicao)", { opacity: 1, duration: DURACAO.lenta, ease: "none" }, "<")
          .from(".ds-onda-anel", { scale: 0.9, duration: DURACAO.media }, "<");
      });
      return () => mm.revert();
    },
    { dependencies: [indiceAceito], scope: raiz, revertOnUpdate: true },
  );

  return (
    <section
      ref={raiz}
      className={["ds-onda", `ds-onda--${estadoAnel}`, className].filter(Boolean).join(" ")}
      aria-label={`Onda ${numero}`}
    >
      <header className="ds-onda-cabeca">
        <div className="ds-onda-titulos">
          <div className="ds-onda-linha-titulo">
            <Titulo className="ds-onda-titulo">Onda {numero}</Titulo>
            {urgente && <Selo urgente />}
          </div>
          {contexto && <p className="ds-onda-contexto">{contexto}</p>}
          <p className="ds-onda-quando">
            {convocados.length} chamados juntos às {formatarHora(enviadaEm)}
          </p>
        </div>
        <div className="ds-onda-prazo">
          <Anel fracao={restante / total} estado={estadoAnel} texto={textoAnel} />
          <p className="ds-onda-prazo-legenda">{legendaPrazo}</p>
          <p className="ds-so-leitor" role="status">{estadoAnel === "correndo" ? "" : leitor}</p>
          {estadoAnel === "correndo" && <p className="ds-so-leitor">{leitor}</p>}
        </div>
      </header>

      <ol className="ds-onda-fila">
        {convocados.map((c, i) => {
          const classe = indiceAceito < 0 ? "" : i === indiceAceito ? " ds-onda-linha--aceita" : " ds-onda-linha--recuada";
          return (
            <li key={`${c.posicao}-${c.nome}`} className={`ds-onda-linha${classe}`}>
              <span className="ds-onda-realce" aria-hidden="true" />
              <span className="ds-onda-pessoa">
                <span className="ds-onda-posicao">
                  <span aria-hidden="true">{c.posicao}º</span>
                  <span className="ds-so-leitor">{c.posicao}º na classificação:</span>
                </span>
                <span className="ds-onda-textos">
                  <span className="ds-onda-nome">{c.nome}</span>
                  {c.detalhe && <span className="ds-onda-detalhe">{c.detalhe}</span>}
                </span>
              </span>
              <span className="ds-onda-estado">
                <Selo convocacao={c.estado} />
              </span>
            </li>
          );
        })}
      </ol>

      {pulados.length > 0 && (
        <div className="ds-onda-pulados">
          <p className="ds-onda-pulados-titulo">Pulados nesta onda, com o motivo registrado</p>
          <ul>
            {pulados.map((p) => (
              <li key={`${p.posicao}-${p.nome}`}>
                <span className="ds-onda-pulado-posicao">{p.posicao}º</span>
                <span className="ds-onda-pulado-nome">{p.nome}</span>
                <span className="ds-onda-pulado-motivo">{p.motivo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
