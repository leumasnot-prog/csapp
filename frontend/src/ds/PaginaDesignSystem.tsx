// Página pública /design-system: mostra o sistema visual inteiro, em claro e
// escuro. Tudo aqui é de exemplo (nomes, escolas e números fictícios).
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Abas, AreaTexto, Botao, Campo, Cartao, Dialogo, GraficoBarras, GraficoLinha, GraficoRosca, ICONES, Indicador, OBJETOS,
  Onda, Painel, Selecao, Selo, Tabela, carregarFontes, prefereMenosMovimento,
  IconeMais, IconeOnda, IconeRepetir, IconeVoltar, IconeRelatorio, ObjetoCelular, ObjetoMegafone, ObjetoPrancheta, ObjetoRelogio,
  type ColunaTabela, type ConvocadoOnda, type EstadoConvocacao, type EstadoSolicitacao,
} from "./index";
import "./pagina.css";

/* ------------------------------------------------------------------ tema */

type Tema = "claro" | "escuro" | "aparelho";
const ATRIBUTO: Record<Tema, string | null> = { claro: "light", escuro: "dark", aparelho: null };

function useTema() {
  const html = document.documentElement;
  const anterior = useRef<string | null>(html.getAttribute("data-theme"));
  const [tema, setTema] = useState<Tema>(() => {
    const atual = anterior.current;
    return atual === "light" ? "claro" : atual === "dark" ? "escuro" : "aparelho";
  });
  useLayoutEffect(() => {
    const v = ATRIBUTO[tema];
    if (v) html.setAttribute("data-theme", v);
    else html.removeAttribute("data-theme");
  }, [tema, html]);
  // devolve o tema que a página tinha antes de abrir esta
  useEffect(() => {
    const original = anterior.current;
    return () => {
      if (original) html.setAttribute("data-theme", original);
      else html.removeAttribute("data-theme");
    };
  }, [html]);
  return [tema, setTema] as const;
}

/* ------------------------------------------------------------------ dados de exemplo */

const HOJE = "2026-11-11";
const as = (hhmm: string) => Date.parse(`${HOJE}T${hhmm}:00-03:00`);

const FILA_ONDA_1: ConvocadoOnda[] = [
  { posicao: 1, nome: "Ana Paula Souza Oliveira", estado: "aguardando", detalhe: "Enviada às 12:52" },
  { posicao: 2, nome: "Bruno Oliveira Ferreira", estado: "aguardando", detalhe: "Enviada às 12:52" },
  { posicao: 3, nome: "Carla Santos Lima", estado: "aguardando", detalhe: "Enviada às 12:52" },
];

function filaOnda2(aceita: boolean): ConvocadoOnda[] {
  return [
    { posicao: 4, nome: "Diego Pereira Oliveira", estado: "recusou", detalhe: "Recusou às 13:09" },
    aceita
      ? { posicao: 5, nome: "Elaine Lima Rodrigues", estado: "aceitou", detalhe: "Aceitou às 13:11" }
      : { posicao: 5, nome: "Elaine Lima Rodrigues", estado: "aguardando", detalhe: "Enviada às 13:08" },
    aceita
      ? { posicao: 7, nome: "Gabriela Almeida Santos", estado: "vaga_preenchida", detalhe: "Enviada às 13:08" }
      : { posicao: 7, nome: "Gabriela Almeida Santos", estado: "aguardando", detalhe: "Enviada às 13:08" },
  ];
}
const PULADOS_ONDA_2 = [{ posicao: 6, nome: "Fábio Costa Almeida", motivo: "declarou indisponibilidade" }];

const SEMANAS = ["25/08", "01/09", "08/09", "15/09", "22/09", "29/09", "06/10", "13/10", "20/10", "27/10", "03/11", "10/11"];
const VAGAS = [5, 7, 6, 9, 8, 11, 10, 13, 12, 14, 13, 16];
const MEDIA_VAGAS = Math.round(VAGAS.reduce((s, v) => s + v, 0) / VAGAS.length);

interface LinhaHoras { professor: string; escola: string; substituicoes: number; horas: number; ultima: string }
const HORAS: LinhaHoras[] = [
  { professor: "Elaine Lima Rodrigues", escola: "EMEF Monteiro Lobato", substituicoes: 6, horas: 27, ultima: "10/11" },
  { professor: "Carla Santos Lima", escola: "EMEI Cecília Meireles", substituicoes: 5, horas: 20, ultima: "07/11" },
  { professor: "Hugo Ferreira Silva", escola: "EMEF Paulo Freire", substituicoes: 4, horas: 18, ultima: "06/11" },
  { professor: "Ana Paula Souza Oliveira", escola: "EMEF Monteiro Lobato", substituicoes: 3, horas: 13.5, ultima: "31/10" },
  { professor: "João Pedro Silva Pereira", escola: "EMEF Paulo Freire", substituicoes: 2, horas: 9, ultima: "28/10" },
];
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const COLUNAS_HORAS: ColunaTabela<LinhaHoras>[] = [
  { chave: "professor", titulo: "Professor", larguraMin: 200 },
  { chave: "escola", titulo: "Unidade", larguraMin: 170 },
  { chave: "substituicoes", titulo: "Substituições", numerica: true },
  { chave: "horas", titulo: "Horas", numerica: true, celula: (l) => NUM.format(l.horas) },
  { chave: "ultima", titulo: "Última", numerica: true },
];

const ESTADOS_CONV: EstadoConvocacao[] = ["aguardando", "aceitou", "recusou", "sem_resposta", "vaga_preenchida", "cancelada", "falha_envio", "conflito", "pulado"];
const ESTADOS_SOL: EstadoSolicitacao[] = ["em_convocacao", "preenchida", "fila_esgotada", "cancelada", "expirada"];

/* ------------------------------------------------------------------ peças da página */

const CORES: { grupo: string; nota: string; itens: [string, string][] }[] = [
  { grupo: "Base", nota: "Texto quase preto sobre papel; névoa no fundo; céu para destaque.", itens: [["tinta", "Tinta"], ["tinta-suave", "Tinta suave"], ["papel", "Papel"], ["nevoa", "Névoa"], ["ceu", "Céu"], ["linha", "Linha"]] },
  { grupo: "Ação", nota: "Azul para a ação principal e para a série principal dos gráficos.", itens: [["azul", "Azul"], ["azul-profundo", "Azul profundo"], ["azul-claro", "Azul claro"]] },
  { grupo: "Prazo", nota: "Laranja só para prazo e urgência. Em texto, o tom mais escuro.", itens: [["laranja", "Laranja"], ["laranja-texto", "Laranja texto"], ["laranja-fundo", "Laranja fundo"]] },
];
const PARES_ESTADO: { nome: string; texto: string; fundo: string; marca: string }[] = [
  { nome: "Aceitou", texto: "verde-texto", fundo: "verde-fundo", marca: "verde" },
  { nome: "Recusou", texto: "vermelho-texto", fundo: "vermelho-fundo", marca: "vermelho" },
  { nome: "Aguardando", texto: "ambar-texto", fundo: "ambar-fundo", marca: "ambar" },
  { nome: "Neutro", texto: "neutro-texto", fundo: "neutro-fundo", marca: "neutro" },
];

function valorToken(nome: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--ds-${nome}`).trim();
}

function Amostra({ token, nome, tema }: { token: string; nome: string; tema: Tema }) {
  const [hex, setHex] = useState("");
  useEffect(() => {
    // espera o tema ser aplicado antes de ler o valor resolvido
    const id = requestAnimationFrame(() => setHex(valorToken(token)));
    return () => cancelAnimationFrame(id);
  }, [token, tema]);
  return (
    <li className="ds-pg-amostra">
      <span className="ds-pg-amostra-cor" style={{ background: `var(--ds-${token})` }} aria-hidden="true" />
      <span className="ds-pg-amostra-nome">{nome}</span>
      <code className="ds-pg-amostra-token">--ds-{token}</code>
      <span className="ds-pg-amostra-hex">{hex}</span>
    </li>
  );
}

function Secao({ id, titulo, intro, acao, children }: { id: string; titulo: string; intro?: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="ds-pg-secao" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="ds-pg-secao-cabeca">
        <div className="ds-pg-secao-textos">
          <h2 className="ds-pg-h2" id={`${id}-titulo`} tabIndex={-1}>{titulo}</h2>
          {intro && <p className="ds-pg-intro">{intro}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Bloco({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={["ds-pg-bloco", className].filter(Boolean).join(" ")}>
      <h3 className="ds-pg-h3">{titulo}</h3>
      {children}
    </div>
  );
}

const SECOES = [
  ["ds-onda", "Onda"], ["ds-cores", "Cores"], ["ds-tipografia", "Tipografia"], ["ds-forma", "Espaço e forma"],
  ["ds-componentes", "Componentes"], ["ds-graficos", "Gráficos"], ["ds-icones", "Ícones"], ["ds-objetos", "Objetos"],
] as const;

const ESCALA = [
  ["4", "4rem", "64px"], ["3", "3rem", "48px"], ["225", "2,25rem", "36px"], ["175", "1,75rem", "28px"], ["1375", "1,375rem", "22px"],
  ["1125", "1,125rem", "18px"], ["1", "1rem", "16px"], ["0875", "0,875rem", "14px"], ["075", "0,75rem", "12px"],
] as const;

/* ------------------------------------------------------------------ página */

export default function PaginaDesignSystem() {
  const [tema, setTema] = useTema();
  const [agora, setAgora] = useState(() => Date.now());
  const inicioAoVivo = useRef(Date.now() - 4 * 60_000 - 18_000);
  const [repeticao, setRepeticao] = useState(0);
  const [aceita, setAceita] = useState(() => prefereMenosMovimento());
  const [filtro, setFiltro] = useState<"todas" | "convocacao" | "preenchidas" | "encerradas">("convocacao");
  const [dialogo, setDialogo] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarFontes();
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // A terceira onda chega aguardando e, logo depois, recebe o aceite.
  useEffect(() => {
    if (prefereMenosMovimento()) {
      setAceita(true);
      return;
    }
    setAceita(false);
    const t = window.setTimeout(() => setAceita(true), 1100);
    return () => window.clearTimeout(t);
  }, [repeticao]);

  useEffect(() => {
    if (!carregando) return;
    const t = window.setTimeout(() => setCarregando(false), 2400);
    return () => window.clearTimeout(t);
  }, [carregando]);

  // a onda ao vivo recomeça quando o prazo acaba
  const prazoAoVivo = inicioAoVivo.current + 15 * 60_000;
  if (agora > prazoAoVivo + 5000) inicioAoVivo.current = agora - 1000;

  function irPara(e: MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const alvo = document.getElementById(id);
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: prefereMenosMovimento() ? "auto" : "smooth", block: "start" });
    alvo.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }

  return (
    <div className="ds-raiz ds-pagina">
      <a className="ds-pg-pular" href="#ds-conteudo" onClick={(e) => irPara(e, "ds-conteudo")}>Ir para o conteúdo</a>
      <header className="ds-pg-topo">
        <div className="ds-pg-marca">
          <span className="ds-pg-marca-simbolo" aria-hidden="true"><IconeOnda tamanho={22} /></span>
          <span className="ds-pg-marca-nome">Substituições</span>
          <span className="ds-pg-marca-parte">Sistema visual</span>
        </div>
        <Abas
          rotulo="Tema"
          valor={tema}
          aoMudar={setTema}
          opcoes={[{ valor: "claro", rotulo: "Claro" }, { valor: "escuro", rotulo: "Escuro" }, { valor: "aparelho", rotulo: "Do aparelho" }]}
        />
      </header>

      <main id="ds-conteudo" className="ds-pg-conteudo">
        {/* ---------------------------------------------------------- abertura */}
        <div className="ds-pg-heroi">
          <div className="ds-pg-heroi-texto">
            <h1 className="ds-pg-h1">Sistema visual do painel de substituições</h1>
            <p className="ds-pg-lead">
              Cores, letras, componentes, ícones, objetos e gráficos que as telas vão usar, em claro e escuro,
              no celular e no computador. Nomes, escolas e números desta página são dados de exemplo.
            </p>
            <nav aria-label="Seções desta página" className="ds-pg-indice">
              {SECOES.map(([id, nome]) => (
                <a key={id} href={`#${id}`} onClick={(e) => irPara(e, id)}>{nome}</a>
              ))}
            </nav>
          </div>
          <Painel className="ds-pg-heroi-palco">
            <ObjetoRelogio className="ds-pg-flutua ds-pg-flutua--relogio" tamanho={132} />
            <ObjetoMegafone className="ds-pg-flutua ds-pg-flutua--megafone" tamanho={124} />
            <ObjetoCelular className="ds-pg-flutua ds-pg-flutua--celular" tamanho={128} />
            <div className="ds-pg-heroi-onda">
              <Onda
                numero={1}
                contexto="Matemática, 7º A, tarde"
                enviadaEm={inicioAoVivo.current}
                prazoAte={inicioAoVivo.current + 15 * 60_000}
                agora={agora}
                convocados={FILA_ONDA_1.map((c) => ({ ...c, detalhe: undefined }))}
                nivelTitulo={2}
                className="ds-pg-onda-flutuante"
              />
            </div>
          </Painel>
        </div>

        {/* ---------------------------------------------------------- onda */}
        <Secao
          id="ds-onda"
          titulo="A onda"
          intro="Três professores chamados ao mesmo tempo, na ordem da classificação, com um prazo correndo. O primeiro aceite leva a vaga; os outros recuam e quem foi pulado aparece com o motivo."
          acao={
            <Botao variante="secundario" icone={<IconeRepetir />} onClick={() => setRepeticao((r) => r + 1)}>
              Repetir a animação
            </Botao>
          }
        >
          <div className="ds-pg-ondas">
            <div className="ds-pg-onda-caso">
              <p className="ds-pg-legenda">Em andamento</p>
              <Onda
                numero={1}
                contexto="Matemática, 7º A, tarde"
                enviadaEm={as("12:52")}
                prazoAte={as("13:07")}
                agora={as("12:57") + 41_000}
                convocados={FILA_ONDA_1}
                repetir={repeticao}
              />
            </div>
            <div className="ds-pg-onda-caso">
              <p className="ds-pg-legenda">Com recusa</p>
              <Onda
                numero={2}
                contexto="Matemática, 7º A, tarde"
                urgente
                enviadaEm={as("13:08")}
                prazoAte={as("13:23")}
                agora={as("13:10") + 12_000}
                convocados={filaOnda2(false)}
                pulados={PULADOS_ONDA_2}
                repetir={repeticao}
              />
            </div>
            <div className="ds-pg-onda-caso">
              <p className="ds-pg-legenda">Aceita</p>
              <Onda
                numero={2}
                contexto="Matemática, 7º A, tarde"
                enviadaEm={as("13:08")}
                prazoAte={as("13:23")}
                agora={as("13:11")}
                aceiteEm={as("13:11")}
                convocados={filaOnda2(aceita)}
                pulados={PULADOS_ONDA_2}
                repetir={repeticao}
              />
            </div>
          </div>
        </Secao>

        {/* ---------------------------------------------------------- cores */}
        <Secao id="ds-cores" titulo="Cores" intro="No claro, fundo branco e superfícies em azul muito claro; no escuro, azul-noite. Um azul vivo para agir e laranja só para o prazo. Os valores abaixo são os do tema que está na tela.">
          <div className="ds-pg-cores">
            {CORES.map((g) => (
              <Bloco key={g.grupo} titulo={g.grupo}>
                <p className="ds-pg-nota">{g.nota}</p>
                <ul className="ds-pg-amostras">
                  {g.itens.map(([t, n]) => <Amostra key={t} token={t} nome={n} tema={tema} />)}
                </ul>
              </Bloco>
            ))}
            <Bloco titulo="Estados da convocação">
              <p className="ds-pg-nota">Cada estado tem marca, fundo e texto. O estado nunca depende só da cor: sempre há texto.</p>
              <ul className="ds-pg-estados">
                {PARES_ESTADO.map((p) => (
                  <li key={p.nome} style={{ background: `var(--ds-${p.fundo})`, color: `var(--ds-${p.texto})` }}>
                    <span className="ds-pg-estado-marca" style={{ background: `var(--ds-${p.marca})` }} aria-hidden="true" />
                    <span className="ds-pg-estado-nome">{p.nome}</span>
                    <code>--ds-{p.marca}</code>
                  </li>
                ))}
              </ul>
            </Bloco>
          </div>
        </Secao>

        {/* ---------------------------------------------------------- tipografia */}
        <Secao id="ds-tipografia" titulo="Tipografia" intro="Oxanium nos títulos e números grandes; DM Sans em todo o resto. As duas servidas pelo próprio painel.">
          <div className="ds-pg-tipos">
            <Cartao className="ds-pg-papeis">
              <div className="ds-pg-papel">
                <p className="ds-display">Vaga preenchida em 6 minutos</p>
                <p className="ds-pg-meta">Display: Oxanium 600, 3rem, entrelinha 1,05, espaçamento −0,03em</p>
              </div>
              <div className="ds-pg-papel">
                <p className="ds-titulo">Acompanhamento da solicitação</p>
                <p className="ds-pg-meta">Título: Oxanium 600, 1,375rem, espaçamento −0,015em</p>
              </div>
              <div className="ds-pg-papel">
                <p className="ds-corpo">A convocação sai em ondas: os primeiros elegíveis da fila recebem ao mesmo tempo, com prazo para responder.</p>
                <p className="ds-pg-meta">Corpo: DM Sans 400, 1rem, entrelinha 1,5</p>
              </div>
              <div className="ds-pg-papel">
                <p className="ds-rotulo">Disciplina e turma</p>
                <p className="ds-pg-meta">Rótulo: DM Sans 500, 0,875rem, em caixa normal</p>
              </div>
              <div className="ds-pg-papel">
                <p className="ds-pg-numeros"><span>13:07</span><span>04:41</span><span>1.284</span></p>
                <p className="ds-pg-meta">Algarismos tabulares em prazos, tabelas e indicadores</p>
              </div>
            </Cartao>
            <ol className="ds-pg-escala" aria-label="Escala de tamanhos">
              {ESCALA.map(([chave, rem, px]) => (
                <li key={chave}>
                  <span className="ds-pg-escala-medida">{rem}<span> {px}</span></span>
                  <span className="ds-pg-escala-amostra" style={{ fontSize: `var(--ds-tam-${chave})` }}>Onda 2</span>
                </li>
              ))}
            </ol>
          </div>
        </Secao>

        {/* ---------------------------------------------------------- espaço e forma */}
        <Secao id="ds-forma" titulo="Espaço, forma e profundidade" intro="Espaço em múltiplos de 4. Raio por papel, não um raio só. Profundidade vem da superfície; sombra, só no que flutua.">
          <div className="ds-pg-forma">
            <Bloco titulo="Espaçamento">
              <ul className="ds-pg-espacos">
                {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
                  <li key={n}>
                    <code>--ds-esp-{n}</code>
                    <span className="ds-pg-espaco-barra" style={{ width: `var(--ds-esp-${n})` }} aria-hidden="true" />
                    <span className="ds-num">{n * 4}px</span>
                  </li>
                ))}
              </ul>
            </Bloco>
            <Bloco titulo="Raios">
              <ul className="ds-pg-raios">
                <li><span style={{ borderRadius: "var(--ds-raio-controle)" }} aria-hidden="true" />Controle<code>10px</code></li>
                <li><span style={{ borderRadius: "var(--ds-raio-cartao)" }} aria-hidden="true" />Cartão<code>16px</code></li>
                <li><span style={{ borderRadius: "var(--ds-raio-painel)" }} aria-hidden="true" />Painel<code>28px</code></li>
                <li><span className="ds-pg-raio-pilula" aria-hidden="true" />Pílula<code>999px</code></li>
              </ul>
            </Bloco>
            <Bloco titulo="Profundidade">
              <div className="ds-pg-camadas">
                <div className="ds-pg-camada-nevoa">
                  <span>Névoa</span>
                  <div className="ds-pg-camada-papel">
                    <span>Papel</span>
                    <div className="ds-pg-camada-ceu">Céu</div>
                  </div>
                </div>
                <Cartao flutuante className="ds-pg-camada-flutua">
                  <p className="ds-rotulo">Só o que flutua tem sombra</p>
                  <code className="ds-pg-meta">--ds-sombra</code>
                </Cartao>
              </div>
            </Bloco>
          </div>
        </Secao>

        {/* ---------------------------------------------------------- componentes */}
        <Secao id="ds-componentes" titulo="Componentes" intro="Peças de base com teclado, foco visível e alvos de toque de 44px.">
          <div className="ds-pg-componentes">
            <Bloco titulo="Botões">
              <Cartao className="ds-pg-palco">
                <div className="ds-pg-fileira">
                  <Botao icone={<IconeMais />}>Nova solicitação</Botao>
                  <Botao variante="secundario">Reabrir</Botao>
                  <Botao variante="perigo" onClick={() => setDialogo(true)}>Cancelar solicitação</Botao>
                  <Botao variante="texto" icone={<IconeVoltar />}>Voltar</Botao>
                </div>
                <div className="ds-pg-fileira">
                  <Botao tamanho="grande">Enviar convocação</Botao>
                  <Botao tamanho="compacto" variante="secundario" icone={<IconeRelatorio />}>Exportar CSV</Botao>
                </div>
                <div className="ds-pg-fileira">
                  <Botao carregando={carregando} textoCarregando="Enviando…" onClick={() => setCarregando(true)}>
                    {carregando ? "Enviando…" : "Toque para carregar"}
                  </Botao>
                  <Botao disabled>Desabilitado</Botao>
                  <Botao variante="texto" disabled>Sem ação</Botao>
                </div>
              </Cartao>
            </Bloco>

            <Bloco titulo="Campos">
              <Cartao className="ds-pg-palco ds-pg-campos">
                <Campo rotulo="Turma" defaultValue="7º A" dica="Como aparece no diário de classe." />
                <Selecao rotulo="Disciplina" defaultValue="mat">
                  <option value="pol">Polivalente</option>
                  <option value="mat">Matemática</option>
                  <option value="por">Língua Portuguesa</option>
                </Selecao>
                <Campo rotulo="Início da aula" defaultValue="13h" required erro="Use o formato de horas e minutos, por exemplo 13:00." />
                <Campo rotulo="Unidade" value="EMEF Monteiro Lobato" disabled readOnly />
                <AreaTexto rotulo="Observações para o professor" placeholder="Ex.: plano de aula com a coordenadora" className="ds-pg-campo-largo" />
              </Cartao>
            </Bloco>

            <Bloco titulo="Selos de estado">
              <Cartao className="ds-pg-palco">
                <p className="ds-pg-nota">Convocação</p>
                <div className="ds-pg-selos">{ESTADOS_CONV.map((e) => <Selo key={e} convocacao={e} />)}</div>
                <p className="ds-pg-nota">Solicitação</p>
                <div className="ds-pg-selos">
                  {ESTADOS_SOL.map((e) => <Selo key={e} solicitacao={e} />)}
                  <Selo urgente />
                </div>
              </Cartao>
            </Bloco>

            <Bloco titulo="Filtros em pílula">
              <Cartao className="ds-pg-palco">
                <Abas
                  rotulo="Filtrar solicitações"
                  valor={filtro}
                  aoMudar={setFiltro}
                  opcoes={[
                    { valor: "todas", rotulo: "Todas", contagem: 12 },
                    { valor: "convocacao", rotulo: "Em convocação", contagem: 3 },
                    { valor: "preenchidas", rotulo: "Preenchidas", contagem: 8 },
                    { valor: "encerradas", rotulo: "Encerradas", contagem: 1 },
                  ]}
                />
                <p className="ds-pg-nota">Setas do teclado trocam a opção; o número é a quantidade em cada filtro.</p>
              </Cartao>
            </Bloco>

            <Bloco titulo="Indicadores" className="ds-pg-largo">
              <p className="ds-pg-nota">Dados de exemplo, não são números de uso real.</p>
              <div className="ds-pg-indicadores">
                <Cartao><Indicador rotulo="Vagas preenchidas em novembro" valor="42" variacao="+6 sobre outubro" serie={[18, 22, 25, 24, 31, 36, 42]} /></Cartao>
                <Cartao><Indicador rotulo="Tempo até o aceite (mediana)" valor="6" unidade="min" variacao="Era 9 min em setembro" serie={[11, 10, 9, 9, 8, 7, 6]} /></Cartao>
                <Cartao><Indicador rotulo="Ondas por vaga" valor="1,4" variacao="Média do mês" serie={[1.9, 1.7, 1.8, 1.5, 1.6, 1.4, 1.4]} /></Cartao>
                <Cartao><Indicador rotulo="Convocações sem resposta" valor="23" unidade="%" variacao="Dentro do prazo da onda" serie={[31, 29, 30, 27, 25, 24, 23]} /></Cartao>
              </div>
            </Bloco>

            <Bloco titulo="Cartão e painel">
              <div className="ds-pg-superficies">
                <Cartao>
                  <div className="ds-pg-solicitacao">
                    <p className="ds-titulo">Matemática, 7º A</p>
                    <Selo solicitacao="em_convocacao" />
                  </div>
                  <p className="ds-apoio">EMEF Monteiro Lobato, de 13 a 17 de novembro, à tarde</p>
                </Cartao>
                <Painel>
                  <p className="ds-titulo">Painel céu</p>
                  <p className="ds-apoio">Raio de 28px, para o destaque da tela: um por tela, no que importa.</p>
                </Painel>
              </div>
            </Bloco>

            <Bloco titulo="Estado vazio">
              <Cartao className="ds-pg-vazio">
                <ObjetoPrancheta tamanho={112} />
                <div>
                  <p className="ds-titulo">Nenhuma solicitação aberta</p>
                  <p className="ds-apoio">Quando um professor faltar, abra uma solicitação e a primeira onda sai na hora.</p>
                </div>
                <Botao icone={<IconeMais />}>Nova solicitação</Botao>
              </Cartao>
            </Bloco>

            <Bloco titulo="Tabela" className="ds-pg-largo">
              <Tabela legenda="Horas de substituição por professor, outubro (dados de exemplo)" legendaVisivel colunas={COLUNAS_HORAS} linhas={HORAS} chaveLinha={(l) => l.professor} />
            </Bloco>

            <Bloco titulo="Diálogo">
              <Cartao className="ds-pg-palco">
                <p className="ds-apoio">Foco preso dentro, Esc fecha e o foco volta ao botão que abriu.</p>
                <div className="ds-pg-fileira">
                  <Botao variante="perigo" onClick={() => setDialogo(true)}>Cancelar solicitação</Botao>
                </div>
              </Cartao>
            </Bloco>
          </div>
        </Secao>

        {/* ---------------------------------------------------------- gráficos */}
        <Secao id="ds-graficos" titulo="Gráficos" intro="SVG próprio, ligado aos tokens. Valores legíveis sem passar o mouse; os números vêm de dados de exemplo.">
          <Painel className="ds-pg-grafico-destaque">
            <GraficoLinha
              titulo="Vagas preenchidas por semana"
              descricao={`Dados de exemplo. Subiu de 5 para 16 vagas por semana em doze semanas; a linha tracejada é a média do período (${MEDIA_VAGAS}).`}
              dados={SEMANAS.map((s, k) => ({ rotulo: s, valor: VAGAS[k], nome: `semana de ${s}` }))}
              formatar={(n) => `${n} ${n === 1 ? "vaga" : "vagas"}`}
              referencia={{ valor: MEDIA_VAGAS, rotulo: `média: ${MEDIA_VAGAS}` }}
              nomeValor="Vagas preenchidas"
            />
          </Painel>
          <div className="ds-pg-graficos">
            <Cartao>
              <GraficoBarras
                titulo="Horas de substituição por unidade"
                descricao="Dados de exemplo, outubro. Base para a conferência de pagamento."
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
                descricao="Dados de exemplo, outubro. Cada convocação enviada e o que aconteceu com ela."
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
        </Secao>

        {/* ---------------------------------------------------------- ícones */}
        <Secao id="ds-icones" titulo="Ícones" intro="Desenho próprio para o vocabulário do produto: grade de 24px, traço de 1,75px, pontas redondas, cor do texto.">
          <Cartao>
            <ul className="ds-pg-icones">
              {ICONES.map(({ nome, Icone }) => (
                <li key={nome}>
                  <span className="ds-pg-icone-caixa"><Icone /></span>
                  <span>{nome}</span>
                </li>
              ))}
            </ul>
          </Cartao>
        </Secao>

        {/* ---------------------------------------------------------- objetos */}
        <Secao id="ds-objetos" titulo="Objetos" intro="Peças com volume do mundo da escola e da convocação, com a luz sempre do alto à esquerda. Flutuam na apresentação e ilustram estados vazios; nunca nas telas do diretor.">
          <ul className="ds-pg-objetos">
            {OBJETOS.map(({ nome, Objeto }) => (
              <li key={nome}>
                <Objeto tamanho={150} />
                <span>{nome}</span>
              </li>
            ))}
          </ul>
        </Secao>
      </main>

      <footer className="ds-pg-rodape">
        <p>Página de referência do design system. Todos os nomes, escolas e números são dados de exemplo.</p>
        <nav className="ds-pg-rodape-links" aria-label="Outras páginas">
          <Link to="/apresentacao">Ver a apresentação</Link>
          <Link to="/login">Ir para a entrada do painel</Link>
        </nav>
      </footer>

      <Dialogo
        aberto={dialogo}
        aoFechar={() => setDialogo(false)}
        alerta
        titulo="Cancelar esta solicitação?"
        descricao="Os professores que ainda não responderam recebem o aviso de cancelamento. O registro fica na auditoria."
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setDialogo(false)}>Manter solicitação</Botao>
            <Botao variante="perigo" onClick={() => setDialogo(false)}>Cancelar solicitação</Botao>
          </>
        }
      >
        <AreaTexto rotulo="Motivo do cancelamento" dica="Aparece no relatório e na auditoria." rows={3} />
      </Dialogo>
    </div>
  );
}
