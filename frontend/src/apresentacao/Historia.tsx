// "Uma convocação, do começo ao fim": a moldura do produto fica fixa e a
// convocação avança com a rolagem. Uma linha do tempo GSAP só, ligada à
// rolagem (pin + scrub), anda um relógio p de 0 a 6; a interface mostrada é a
// do produto (Onda, ResumoSolicitacao, Registro), redesenhada a partir de p.
//
// Três formas, escolhidas por CSS e por gsap.matchMedia com as mesmas
// condições (FIXADA e SEQUENCIA_ANIMADA):
// - tela larga e alta, com movimento: moldura fixa, legenda ao lado;
// - celular, tablet ou tela baixa, com movimento: seis passos em sequência,
//   cada um com a sua moldura, que avança enquanto o passo cruza a tela;
// - menos movimento: os seis passos em sequência, completos e parados.
import { useCallback, useRef, useState, type MouseEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { IconeOnda, Onda, Registro, ResumoOnda, ResumoSolicitacao, formatarHora, useGSAP } from "../ds";
import {
  CAMADAS_DO_PASSO, DISCIPLINA, DURACAO_HISTORIA, ESCOLA, FIM_PASSO, HORARIO, INICIO_PASSO, ONDA1, ONDA2, PASSOS, PULADOS_ONDA1, REGISTRO,
  SUBSTITUTO, TURMA, ACEITE, aceiteOnda2Em, camadaEm, filaEm, onda1Em, onda2Em, passoEm, relogioEm, solicitacaoEm, type Camada,
} from "./historia";

/** Mesmas condições das regras de apresentacao.css. */
export const FIXADA = "(min-width: 961px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)";
export const SEQUENCIA_ANIMADA = "(max-width: 960px) and (prefers-reduced-motion: no-preference), (max-height: 699px) and (prefers-reduced-motion: no-preference)";

const quantizar = (p: number) => Math.round(p * 400) / 400;

/* ------------------------------------------------------------------ moldura */

interface PropsQuadro {
  p: number;
  camadas: Camada[];
  /** Nível dos títulos dentro da moldura. */
  nivel?: 3 | 4;
}

/** A tela do diretor no instante p. Estrutura fixa: o GSAP só mexe em opacidade e posição. */
function Quadro({ p, camadas, nivel = 3 }: PropsQuadro) {
  const relogio = relogioEm(p);
  const sol = solicitacaoEm(p);
  const ativa = camadaEm(p);
  const tem = (c: Camada) => camadas.includes(c);
  const classe = (c: Camada) => `ds-ap-camada ds-ap-camada--${c}${ativa === c ? " ds-ap-camada--ativa" : ""}`;
  const subnivel = (nivel + 1) as 4;
  return (
    <div className="ds-ap-quadro">
      <div className="ds-ap-quadro-barra">
        <span className="ds-ap-quadro-app">
          <span className="ds-ap-marca-simbolo ds-ap-marca-simbolo--mini" aria-hidden="true"><IconeOnda tamanho={14} /></span>
          Acompanhamento
        </span>
        <span className="ds-ap-quadro-hora ds-num">
          <span className="ds-ap-quadro-agora">Agora</span> {formatarHora(relogio)}
        </span>
      </div>
      <ResumoSolicitacao
        escola={ESCOLA}
        disciplina={DISCIPLINA}
        turma={TURMA}
        horario={HORARIO}
        estado={sol.estado}
        substituto={sol.preenchida ? SUBSTITUTO : undefined}
        semSubstituto={sol.espera}
        nivelTitulo={nivel}
      />
      <div className="ds-ap-camadas">
        {tem("fila") && (
          <div className={classe("fila")}>
            <Registro titulo="Lista de classificação de Matemática" descricao="Quem está à frente é chamado primeiro." itens={filaEm(p)} nivelTitulo={subnivel} />
          </div>
        )}
        {tem("onda1") && (
          <div className={classe("onda1")}>
            <Onda
              numero={1}
              animar={false}
              enviadaEm={ONDA1.enviada}
              prazoAte={ONDA1.prazo}
              agora={Math.max(relogio, ONDA1.enviada)}
              convocados={onda1Em(p)}
              pulados={PULADOS_ONDA1}
              nivelTitulo={subnivel}
            />
          </div>
        )}
        {tem("onda2") && (
          <div className={classe("onda2")}>
            <ResumoOnda numero={1} encerradaEm={ONDA1.prazo} resumo="1 recusa e 2 sem resposta" />
            <Onda
              numero={2}
              animar={false}
              enviadaEm={ONDA2.enviada}
              prazoAte={ONDA2.prazo}
              agora={Math.max(relogio, ONDA2.enviada)}
              aceiteEm={aceiteOnda2Em(p)}
              convocados={onda2Em(p)}
              nivelTitulo={subnivel}
            />
          </div>
        )}
        {tem("registro") && (
          <div className={classe("registro")}>
            <Registro titulo="Registro da solicitação" descricao="Na ordem da classificação, com horário e motivo." itens={REGISTRO} nivelTitulo={subnivel} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ linha do tempo */

/**
 * Monta a linha do tempo da história dentro de `raiz` (1 unidade = 1 passo).
 * Só transform e opacidade (autoAlpha também esconde do leitor de tela o que
 * saiu). O conteúdo de cada instante vem de p, que a linha entrega a `aoMudar`.
 * Peças que não existem nesta moldura são puladas, sem aviso no console.
 */
function montarLinha(raiz: HTMLElement, aoMudar: (p: number) => void, vars: gsap.TimelineVars = {}) {
  const q = gsap.utils.selector(raiz);
  const existe = (sel: string) => q(sel).length > 0;
  const tl = gsap.timeline({ defaults: { ease: "power2.inOut" }, ...vars });
  const relogio = { p: 0 };
  tl.to(relogio, { p: 6, duration: 6, ease: "none", onUpdate: () => aoMudar(quantizar(relogio.p)) }, 0);

  const sai = (sel: string, em: number) => existe(sel) && tl.to(q(sel), { autoAlpha: 0, y: -18, duration: 0.25 }, em);
  const entra = (sel: string, em: number) => existe(sel) && tl.fromTo(q(sel), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out" }, em);
  const linhas = (sel: string, em: number) =>
    existe(sel) && tl.fromTo(q(sel), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.18, stagger: 0.05, ease: "power2.out" }, em);

  // passo 2: a fila vira a primeira onda
  sai(".ds-ap-camada--fila", 1);
  entra(".ds-ap-camada--onda1", 1.06);
  linhas(".ds-ap-camada--onda1 .ds-onda-linha", 1.12);
  // passo 4: a primeira onda se recolhe numa linha e a segunda chega
  sai(".ds-ap-camada--onda1", 3);
  entra(".ds-ap-camada--onda2", 3.06);
  linhas(".ds-ap-camada--onda2 .ds-onda-linha", 3.14);
  // passo 5: o destaque verde varre a linha de quem aceitou
  if (existe(".ds-ap-camada--onda2 .ds-onda-linha:nth-child(2) .ds-onda-realce")) {
    tl.fromTo(
      q(".ds-ap-camada--onda2 .ds-onda-linha:nth-child(2) .ds-onda-realce"),
      { scaleX: 0, transformOrigin: "0% 50%" },
      { scaleX: 1, duration: 0.22, ease: "power2.out" },
      ACEITE,
    );
  }
  // passo 6: o registro, linha a linha
  sai(".ds-ap-camada--onda2", 5);
  entra(".ds-ap-camada--registro", 5.06);
  linhas(".ds-ap-camada--registro .ds-registro-item", 5.14);

  // legendas (só na moldura fixa): uma sai, a seguinte entra na virada do passo
  const legendas = q(".ds-ap-legenda");
  for (let n = 1; n < legendas.length; n++) {
    tl.to(legendas[n - 1], { autoAlpha: 0, y: -14, duration: 0.14, ease: "power1.in" }, n - 0.1);
    tl.fromTo(legendas[n], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.16, ease: "power2.out" }, n + 0.02);
  }
  // trilho do progresso
  if (existe(".ds-ap-trilho-cheio")) {
    tl.fromTo(q(".ds-ap-trilho-cheio"), { scaleY: 0 }, { scaleY: 1, duration: 6, ease: "none", transformOrigin: "50% 0%" }, 0);
  }
  // pausa no registro antes de soltar a moldura
  tl.to({}, { duration: DURACAO_HISTORIA - 6 }, 6);
  return tl;
}

/* ------------------------------------------------------------------ passo em sequência */

function PassoSequencia({ indice }: { indice: number }) {
  const raiz = useRef<HTMLLIElement>(null);
  const fim = FIM_PASSO[indice];
  // estado inicial completo: sem JavaScript, ou com menos movimento, o passo aparece pronto
  const [p, setP] = useState(fim);
  const passo = PASSOS[indice];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(SEQUENCIA_ANIMADA, () => {
        const quadro = raiz.current!.querySelector<HTMLElement>(".ds-ap-quadro")!;
        const tl = montarLinha(quadro, setP, { paused: true });
        gsap.fromTo(
          tl,
          { time: INICIO_PASSO[indice] },
          {
            time: fim,
            ease: "none",
            scrollTrigger: { trigger: quadro, start: "top 82%", end: "top 18%", scrub: 0.4 },
          },
        );
        return () => setP(fim);
      });
      return () => mm.revert();
    },
    { scope: raiz },
  );

  return (
    <li className="ds-ap-seq-passo" ref={raiz}>
      <div className="ds-ap-seq-legenda">
        <span className="ds-ap-seq-numero" aria-hidden="true">{indice + 1}</span>
        <div className="ds-ap-seq-textos">
          <h3 className="ds-ap-legenda-titulo">{passo.titulo}</h3>
          <p className="ds-ap-legenda-texto">{passo.texto}</p>
        </div>
      </div>
      <div className="ds-ap-moldura">
        <Quadro p={p} camadas={CAMADAS_DO_PASSO[indice]} nivel={4} />
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ seção */

export function Historia({ id }: { id: string }) {
  const raiz = useRef<HTMLElement>(null);
  const gatilho = useRef<ScrollTrigger | null>(null);
  const [p, setP] = useState(0);
  const atual = passoEm(p);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(FIXADA, () => {
        const palco = raiz.current!.querySelector<HTMLElement>(".ds-ap-palco")!;
        const tl = montarLinha(palco, setP, {
          scrollTrigger: {
            trigger: palco,
            pin: true,
            start: "top top",
            end: () => `+=${Math.round(window.innerHeight * 5)}`,
            scrub: 0.5,
            invalidateOnRefresh: true,
            refreshPriority: 1,
          },
        });
        gatilho.current = tl.scrollTrigger ?? null;
        ScrollTrigger.sort();
        return () => {
          gatilho.current = null;
          setP(0);
        };
      });
      return () => mm.revert();
    },
    { scope: raiz },
  );

  // O indicador de progresso também leva a cada passo.
  const irPara = useCallback((e: MouseEvent<HTMLButtonElement>, n: number) => {
    const st = gatilho.current;
    if (!st) return;
    e.preventDefault();
    const alvo = st.start + ((FIM_PASSO[n] - (n === 5 ? 0.3 : 0.25)) / DURACAO_HISTORIA) * (st.end - st.start);
    window.scrollTo({ top: Math.round(alvo), behavior: "smooth" });
  }, []);

  return (
    <section className="ds-ap-secao ds-ap-historia" id={id} aria-labelledby={`${id}-titulo`} ref={raiz}>
      <div className="ds-ap-largura ds-ap-secao-cabeca">
        <h2 className="ds-ap-h2" id={`${id}-titulo`} tabIndex={-1}>Uma convocação, do começo ao fim</h2>
        <p className="ds-ap-intro">
          Uma falta de Matemática numa terça-feira, seguida passo a passo na tela de quem abriu a vaga. Role a página para a convocação andar.
        </p>
      </div>

      {/* moldura fixa (tela larga, com movimento) */}
      <div className="ds-ap-fixada">
        <div className="ds-ap-palco ds-ap-largura">
          <div className="ds-ap-lado">
            <div className="ds-ap-legendas">
              {PASSOS.map((passo, n) => (
                <div key={passo.curto} className="ds-ap-legenda" aria-hidden={n !== atual}>
                  <h3 className="ds-ap-legenda-titulo">{passo.titulo}</h3>
                  <p className="ds-ap-legenda-texto">{passo.texto}</p>
                </div>
              ))}
            </div>
            <nav className="ds-ap-progresso" aria-label="Passos da convocação">
              <span className="ds-ap-trilho" aria-hidden="true"><span className="ds-ap-trilho-cheio" /></span>
              <ol>
                {PASSOS.map((passo, n) => (
                  <li key={passo.curto}>
                    <button
                      type="button"
                      className={`ds-ap-passo${n === atual ? " ds-ap-passo--atual" : n < atual ? " ds-ap-passo--feito" : ""}`}
                      aria-current={n === atual ? "step" : undefined}
                      onClick={(e) => irPara(e, n)}
                    >
                      <span className="ds-ap-passo-ponto" aria-hidden="true" />
                      {passo.curto}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
          <div className="ds-ap-moldura" inert>
            <Quadro p={p} camadas={["fila", "onda1", "onda2", "registro"]} />
          </div>
        </div>
      </div>

      {/* seis passos em sequência (celular, tablet, tela baixa ou menos movimento) */}
      <ol className="ds-ap-sequencia ds-ap-largura">
        {PASSOS.map((passo, n) => (
          <PassoSequencia key={passo.curto} indice={n} />
        ))}
      </ol>
    </section>
  );
}
