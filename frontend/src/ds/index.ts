// Ponto de entrada do design system. Importe os estilos uma vez (tokens e
// componentes) e use as peças dentro de um elemento com a classe .ds-raiz.
import "./tokens.css";
import "./componentes.css";

export { carregarFontes } from "./fontes";
export { gsap, useGSAP, DURACAO, CURVA_SAIDA, COM_MOVIMENTO, prefereMenosMovimento } from "./movimento";

export { Botao, type PropsBotao, type VarianteBotao, type TamanhoBotao } from "./componentes/Botao";
export { Campo, Selecao, AreaTexto, type PropsCampo, type PropsSelecao, type PropsAreaTexto } from "./componentes/Campo";
export { Cartao, Painel, type PropsCartao } from "./componentes/Cartao";
export { Selo, SELOS_CONVOCACAO, SELOS_SOLICITACAO, type EstadoConvocacao, type EstadoSolicitacao, type PropsSelo } from "./componentes/Selo";
export { Indicador, type PropsIndicador } from "./componentes/Indicador";
export { Tabela, type ColunaTabela, type PropsTabela } from "./componentes/Tabela";
export { Abas, type OpcaoAba, type PropsAbas } from "./componentes/Abas";
export { Dialogo, type PropsDialogo } from "./componentes/Dialogo";
export { Onda, formatarHora, type ConvocadoOnda, type PuladoOnda, type PropsOnda } from "./componentes/Onda";

export { GraficoLinha, type PontoLinha, type PropsGraficoLinha } from "./graficos/GraficoLinha";
export { GraficoBarras, type ItemBarra, type PropsGraficoBarras } from "./graficos/GraficoBarras";
export { GraficoRosca, type FatiaRosca, type PropsGraficoRosca } from "./graficos/GraficoRosca";
export { MiniGrafico, type PropsMiniGrafico } from "./graficos/MiniGrafico";

export * from "./icones";
export * from "./objetos";
