// Página pública /apresentacao: o que o painel faz, para quem abre a vaga,
// para a Secretaria e para o professor. Feita só com peças do design system.
// Nomes, escolas, telefones e números são dados de exemplo.
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Botao, Cartao, GraficoBarras, GraficoLinha, GraficoRosca, IconeOnda, Onda, Painel, carregarFontes, classesBotao, prefereMenosMovimento, useGSAP,
  CURVA_SAIDA, COM_MOVIMENTO, ObjetoCalendario, ObjetoCelular, ObjetoMegafone, ObjetoRelogio, ObjetoSino, type ConvocadoOnda,
} from "../ds";
import { Historia } from "./Historia";
import "../ds/pagina.css";
import "./apresentacao.css";

// Registrado uma vez, só neste pedaço do painel (carregado quando a página abre).
gsap.registerPlugin(ScrollTrigger);

const ID_HISTORIA = "como-funciona";

/* ------------------------------------------------------------------ topo */

function Marca() {
  return (
    <span className="ds-ap-marca">
      <span className="ds-ap-marca-simbolo" aria-hidden="true"><IconeOnda tamanho={22} /></span>
      <span className="ds-ap-marca-nome">Substituições</span>
    </span>
  );
}

/* ------------------------------------------------------------------ abertura */

const FILA_HEROI: ConvocadoOnda[] = [
  { posicao: 2, nome: "Bruno Oliveira Ferreira", estado: "aguardando" },
  { posicao: 3, nome: "Carla Santos Lima", estado: "aguardando" },
  { posicao: 4, nome: "Diego Pereira Oliveira", estado: "aguardando" },
];

/** A onda ao vivo da abertura: o prazo corre de verdade e recomeça quando acaba. */
function OndaAoVivo() {
  const [agora, setAgora] = useState(() => Date.now());
  const inicio = useRef(Date.now() - 4 * 60_000 - 18_000);
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (agora > inicio.current + 15 * 60_000 + 5000) inicio.current = agora - 1000;
  return (
    <Onda
      numero={1}
      animar={false}
      contexto="Matemática, 7º A, tarde"
      enviadaEm={inicio.current}
      prazoAte={inicio.current + 15 * 60_000}
      agora={agora}
      convocados={FILA_HEROI}
      className="ds-ap-heroi-onda"
    />
  );
}

/** Objetos em volta da onda: três camadas de transform (rolagem, ponteiro, flutuação). */
const OBJETOS_HEROI = [
  { chave: "relogio", Objeto: ObjetoRelogio, prof: 1 },
  { chave: "sino", Objeto: ObjetoSino, prof: 0.6 },
  { chave: "megafone", Objeto: ObjetoMegafone, prof: 0.8 },
  { chave: "celular", Objeto: ObjetoCelular, prof: 1.2 },
  { chave: "calendario", Objeto: ObjetoCalendario, prof: 0.5 },
] as const;

function Heroi({ aoVerComoFunciona }: { aoVerComoFunciona: (e: MouseEvent<HTMLButtonElement>) => void }) {
  const raiz = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(COM_MOVIMENTO, () => {
        // entrada: um momento só, orquestrado
        const entrada = gsap.timeline({ defaults: { ease: CURVA_SAIDA } });
        entrada
          .from(".ds-ap-h1", { autoAlpha: 0, y: 28, duration: 0.8 })
          .from(".ds-ap-lead", { autoAlpha: 0, y: 20, duration: 0.7 }, "<0.08")
          .from(".ds-ap-heroi-acoes", { autoAlpha: 0, y: 16, duration: 0.6 }, "<0.08")
          .from(".ds-ap-heroi-palco", { autoAlpha: 0, y: 48, scale: 0.97, duration: 0.9 }, "<0.06")
          .from(".ds-ap-heroi-onda", { autoAlpha: 0, y: 28, duration: 0.7 }, "<0.18")
          .from(".ds-ap-heroi-onda .ds-onda-linha", { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.07 }, "<0.12")
          .from(".ds-ap-flutua-giro", { autoAlpha: 0, scale: 0.6, duration: 0.8, stagger: 0.07 }, "<0.02");

        // flutuação ociosa, parada quando a abertura sai da tela
        const giros = gsap.utils.toArray<HTMLElement>(".ds-ap-flutua-giro");
        const flutuacao = giros.map((el, i) =>
          gsap.to(el, {
            y: i % 2 ? 7 : -8,
            rotation: i % 2 ? -3 : 3,
            duration: 3.2 + i * 0.45,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: 1 + i * 0.2,
          }),
        );

        // rolagem: os objetos sobem em velocidades diferentes
        const palco = raiz.current!.querySelector(".ds-ap-heroi-palco")!;
        gsap.utils.toArray<HTMLElement>(".ds-ap-flutua").forEach((el) => {
          const prof = Number(el.dataset.prof ?? 1);
          gsap.to(el, { y: -70 * prof, ease: "none", scrollTrigger: { trigger: palco, start: "top 70%", end: "bottom top", scrub: true } });
        });
        ScrollTrigger.create({
          trigger: palco,
          start: "top bottom",
          end: "bottom top",
          onToggle: (st) => flutuacao.forEach((t) => (st.isActive ? t.resume() : t.pause())),
        });
      });

      // ponteiro: só com mouse, e só com movimento
      mm.add(`${COM_MOVIMENTO} and (hover: hover) and (pointer: fine)`, () => {
        const palco = raiz.current!.querySelector<HTMLElement>(".ds-ap-heroi-palco")!;
        const alvos = gsap.utils.toArray<HTMLElement>(".ds-ap-flutua-ponteiro").map((el) => ({
          prof: Number(el.dataset.prof ?? 1),
          x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3" }),
          y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3" }),
        }));
        const mover = (e: PointerEvent) => {
          const r = palco.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          for (const a of alvos) {
            a.x(dx * 26 * a.prof);
            a.y(dy * 18 * a.prof);
          }
        };
        const sair = () => alvos.forEach((a) => (a.x(0), a.y(0)));
        const area = raiz.current!;
        area.addEventListener("pointermove", mover);
        area.addEventListener("pointerleave", sair);
        return () => {
          area.removeEventListener("pointermove", mover);
          area.removeEventListener("pointerleave", sair);
        };
      });
      return () => mm.revert();
    },
    { scope: raiz },
  );

  return (
    <section className="ds-ap-heroi" aria-labelledby="ap-titulo" ref={raiz}>
      <div className="ds-ap-largura ds-ap-heroi-texto">
        <h1 className="ds-ap-h1" id="ap-titulo">Chame o professor substituto em minutos, na ordem da classificação</h1>
        <p className="ds-ap-lead">
          Você abre a vaga no celular. O painel chama os três primeiros da lista ao mesmo tempo, passa aos seguintes se ninguém aceitar e
          guarda o registro de cada passo.
        </p>
        <div className="ds-ap-heroi-acoes">
          <Link to="/login" className={classesBotao({ tamanho: "grande" })}>Entrar</Link>
          <Botao variante="secundario" tamanho="grande" onClick={aoVerComoFunciona}>Ver como funciona</Botao>
        </div>
      </div>
      <figure className="ds-ap-largura ds-ap-heroi-figura">
        <Painel className="ds-ap-heroi-palco">
          {OBJETOS_HEROI.map(({ chave, Objeto, prof }) => (
            <span key={chave} className={`ds-ap-flutua ds-ap-flutua--${chave}`} data-prof={prof} aria-hidden="true">
              <span className="ds-ap-flutua-ponteiro" data-prof={prof}>
                <span className="ds-ap-flutua-giro">
                  <Objeto tamanho={160} />
                </span>
              </span>
            </span>
          ))}
          <div className="ds-ap-heroi-cartao">
            <OndaAoVivo />
          </div>
        </Painel>
        <figcaption className="ds-ap-nota">Nomes, escolas e números desta página são de exemplo.</figcaption>
      </figure>
    </section>
  );
}

/* ------------------------------------------------------------------ secretaria */

const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const SEMANAS = ["25/08", "01/09", "08/09", "15/09", "22/09", "29/09", "06/10", "13/10", "20/10", "27/10", "03/11", "10/11"];
const PREENCHIMENTO = [61, 66, 64, 72, 70, 78, 76, 83, 81, 88, 86, 92];

function Secretaria() {
  const raiz = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(COM_MOVIMENTO, () => {
        const tl = gsap.timeline({
          defaults: { ease: CURVA_SAIDA },
          scrollTrigger: { trigger: ".ds-ap-graficos", start: "top 78%", once: true },
        });
        tl.from(".ds-ap-graficos .ds-grafico-svg > path", { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.08 })
          .from(".ds-ap-graficos .ds-grafico-marcador", { autoAlpha: 0, scale: 0.4, transformOrigin: "50% 50%", duration: 0.5 }, "<0.4")
          .from(".ds-ap-graficos :is(.ds-grafico-pilula, .ds-grafico-pilula-texto)", { autoAlpha: 0, duration: 0.4 }, "<0.1")
          .from(".ds-ap-graficos .ds-grafico-barra", { scaleX: 0, transformOrigin: "0% 50%", duration: 0.9, stagger: 0.08 }, 0.15)
          .from(".ds-ap-graficos .ds-grafico-valor", { autoAlpha: 0, duration: 0.4, stagger: 0.08 }, "<0.5")
          .from(".ds-ap-graficos .ds-rosca-fatia", { autoAlpha: 0, rotation: -40, svgOrigin: "100 100", duration: 0.9, stagger: 0.08 }, 0.25);
      });
      return () => mm.revert();
    },
    { scope: raiz },
  );

  return (
    <section className="ds-ap-secao ds-ap-largura" aria-labelledby="ap-secretaria" ref={raiz}>
      <div className="ds-ap-secao-cabeca">
        <h2 className="ds-ap-h2" id="ap-secretaria">Para a Secretaria</h2>
        <p className="ds-ap-intro">
          A rede inteira numa tela: quantas vagas foram preenchidas, quantas horas cada escola usou e o que aconteceu com cada convocação.
          Os relatórios de horas por professor e por unidade saem em planilha para a conferência do pagamento.
        </p>
      </div>
      <div className="ds-ap-graficos">
        <Cartao className="ds-ap-grafico-largo">
          <GraficoLinha
            titulo="Preenchimento das vagas por semana"
            descricao="Dados de exemplo. Quantas das vagas abertas na semana tiveram substituto; a linha tracejada é a meta da rede."
            dados={SEMANAS.map((s, k) => ({ rotulo: s, valor: PREENCHIMENTO[k], nome: `semana de ${s}` }))}
            formatar={(n) => `${n}% preenchidas`}
            referencia={{ valor: 85, rotulo: "meta: 85%" }}
            nomeValor="Vagas preenchidas (%)"
          />
        </Cartao>
        <Cartao>
          <GraficoBarras
            titulo="Horas de substituição por unidade"
            descricao="Dados de exemplo, outubro. Quanto cada escola usou, para conferir o pagamento."
            dados={[
              { rotulo: "EMEF Monteiro Lobato", valor: 86 },
              { rotulo: "EMEF Paulo Freire", valor: 64 },
              { rotulo: "EMEI Cecília Meireles", valor: 42 },
            ]}
            formatar={(n) => `${NUM.format(n)} h`}
            nomeValor="Horas"
          />
        </Cartao>
        <Cartao>
          <GraficoRosca
            titulo="Convocações por resultado"
            descricao="Dados de exemplo, outubro. Mostra se a fila responde ou se o prazo das ondas precisa mudar."
            rotuloTotal="convocações"
            dados={[
              { rotulo: "Aceitou", valor: 31, cor: "verde" },
              { rotulo: "Não respondeu", valor: 18, cor: "ambar" },
              { rotulo: "Recusou", valor: 22, cor: "vermelho" },
              { rotulo: "Pulado", valor: 9, cor: "neutro" },
            ]}
          />
        </Cartao>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ professor */

type Resposta = "aceito" | "recuso" | null;

function Professor() {
  const [resposta, setResposta] = useState<Resposta>(null);
  return (
    <section className="ds-ap-secao ds-ap-largura ds-ap-professor" aria-labelledby="ap-professor">
      <div className="ds-ap-professor-texto">
        <h2 className="ds-ap-h2" id="ap-professor">Para o professor</h2>
        <ul className="ds-ap-frases">
          <li>A convocação chega no celular, pelo aplicativo de mensagens, com escola, turma, horário e o prazo para responder.</li>
          <li>Um toque responde: Aceito ou Recuso.</li>
          <li>Não tem senha, cadastro nem painel para abrir.</li>
        </ul>
      </div>
      <div className="ds-ap-professor-cena">
        <ObjetoCelular className="ds-ap-professor-celular" tamanho={220} />
        <Cartao className="ds-ap-mensagem" como="article" aria-label="Exemplo de mensagem de convocação">
          <p className="ds-ap-mensagem-titulo">Convocação para substituição</p>
          <dl className="ds-ap-mensagem-dados">
            <div><dt>Unidade</dt><dd>EMEF Monteiro Lobato</dd></div>
            <div><dt>Aula</dt><dd>Matemática, 7º A</dd></div>
            <div><dt>Horário</dt><dd className="ds-num">Hoje, 13:00 às 14:40</dd></div>
            <div><dt>Responda até</dt><dd className="ds-num ds-ap-mensagem-prazo">13:22</dd></div>
          </dl>
          {resposta === null ? (
            <div className="ds-ap-mensagem-acoes">
              <Botao onClick={() => setResposta("aceito")}>Aceito</Botao>
              <Botao variante="secundario" onClick={() => setResposta("recuso")}>Recuso</Botao>
            </div>
          ) : (
            <div className="ds-ap-mensagem-resposta">
              <p role="status">
                {resposta === "aceito"
                  ? "Aceite registrado. A vaga é sua e a escola já recebeu o seu nome."
                  : "Recusa registrada. A vaga segue para o próximo da lista."}
              </p>
              <Botao variante="texto" tamanho="compacto" onClick={() => setResposta(null)}>Ver a mensagem de novo</Botao>
            </div>
          )}
        </Cartao>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ página */

export default function PaginaApresentacao() {
  useEffect(() => {
    carregarFontes();
    // a altura dos títulos muda quando a Oxanium chega: recalcula o ponto de fixar
    let vivo = true;
    document.fonts?.ready.then(() => vivo && ScrollTrigger.refresh());
    return () => {
      vivo = false;
    };
  }, []);

  function verComoFunciona(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const alvo = document.getElementById(ID_HISTORIA);
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: prefereMenosMovimento() ? "auto" : "smooth", block: "start" });
    alvo.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }

  return (
    <div className="ds-raiz ds-pagina ds-ap">
      <a className="ds-pg-pular" href="#ap-conteudo">Ir para o conteúdo</a>
      <header className="ds-ap-topo ds-ap-largura">
        <Marca />
        <nav className="ds-ap-topo-acoes" aria-label="Principal">
          <Link to="/design-system" className="ds-ap-topo-link">Design system</Link>
          <Link to="/login" className={classesBotao({ tamanho: "compacto" })}>Entrar</Link>
        </nav>
      </header>

      <main id="ap-conteudo">
        <Heroi aoVerComoFunciona={verComoFunciona} />
        <Historia id={ID_HISTORIA} />
        <Secretaria />
        <Professor />

        <section className="ds-ap-secao ds-ap-largura ds-ap-fecho" aria-labelledby="ap-fecho">
          <h2 className="ds-ap-h2" id="ap-fecho">Na próxima falta, a vaga sai em uma onda e o registro fica pronto.</h2>
          <Link to="/login" className={classesBotao({ tamanho: "grande" })}>Entrar</Link>
        </section>
      </main>

      <footer className="ds-ap-rodape ds-ap-largura">
        <Marca />
        <p>Convocação de professores substitutos da rede municipal de Pradópolis.</p>
        <nav className="ds-ap-rodape-links" aria-label="Rodapé">
          <Link to="/design-system">Design system</Link>
          <Link to="/login">Entrar</Link>
        </nav>
      </footer>
    </div>
  );
}
