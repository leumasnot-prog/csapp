// Ícones de interface do design system: desenho próprio, grade de 24px,
// traço de 1,75px, pontas e cantos arredondados, cor do texto (currentColor).
// Área viva de 3 a 21 na grade; formas fechadas com raio de 1,5 a 2,5.
//
// Decorativos por padrão (aria-hidden). Com `titulo`, viram imagem nomeada.
import type { ReactNode, SVGProps } from "react";

export interface PropsIcone extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Lado em px (padrão 24). O traço escala junto, mantendo a proporção. */
  tamanho?: number;
  /** Nome acessível. Sem ele o ícone é decorativo. */
  titulo?: string;
}

function criar(nome: string, desenho: ReactNode) {
  function Icone({ tamanho = 24, titulo, className, ...resto }: PropsIcone) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={tamanho}
        height={tamanho}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className ? `ds-icone ${className}` : "ds-icone"}
        aria-hidden={titulo ? undefined : true}
        role={titulo ? "img" : undefined}
        aria-label={titulo}
        focusable="false"
        {...resto}
      >
        {titulo && <title>{titulo}</title>}
        {desenho}
      </svg>
    );
  }
  Icone.displayName = `Icone${nome}`;
  return Icone;
}

/** Prédio escolar com frontão, sino na fachada e porta. */
export const IconeEscola = criar(
  "Escola",
  <>
    <path d="M3 20.5h18" />
    <path d="M5 20.5V10.2L12 5.5l7 4.7v10.3" />
    <path d="M10 20.5v-4.25a2 2 0 0 1 4 0v4.25" />
    <circle cx="12" cy="11" r="1.6" />
    <path d="M12 5.5V3" />
    <path d="M12 3h3l-.8 1 .8 1h-3" />
  </>,
);

/** Professor: busto com um quadro ao lado. */
export const IconeProfessor = criar(
  "Professor",
  <>
    <circle cx="8.5" cy="8.5" r="3" />
    <path d="M3 20c0-3.3 2.46-5.5 5.5-5.5 1.6 0 3 .6 4 1.6" />
    <rect x="13.5" y="3.5" width="7.5" height="6" rx="1.5" />
    <path d="M11.5 14.5l3-3" />
  </>,
);

/** Onda: três chamados ao mesmo tempo sobre uma onda. */
export const IconeOnda = criar(
  "Onda",
  <>
    <circle cx="6" cy="7.5" r="1.75" />
    <circle cx="12" cy="7.5" r="1.75" />
    <circle cx="18" cy="7.5" r="1.75" />
    <path d="M3 15.5c1.5 0 2-2.25 4.5-2.25S10.5 17 12 17s2-3.75 4.5-3.75S19.5 15.5 21 15.5" />
  </>,
);

/** Convocação: megafone com ondas de som. */
export const IconeConvocacao = criar(
  "Convocacao",
  <>
    <path d="M4 10.25v3.5a1.5 1.5 0 0 0 1.5 1.5H7l7.5 4V4.75L7 8.75H5.5A1.5 1.5 0 0 0 4 10.25z" />
    <path d="M7.5 15.25l1 4.25" />
    <path d="M18 9.25a3.75 3.75 0 0 1 0 5.5" />
    <path d="M20.25 7a7 7 0 0 1 0 10" />
  </>,
);

/** Prazo: cronômetro. */
export const IconePrazo = criar(
  "Prazo",
  <>
    <circle cx="12" cy="13.5" r="7.25" />
    <path d="M12 10v3.5l2.25 1.5" />
    <path d="M9.75 3h4.5" />
    <path d="M12 3v3" />
    <path d="M18.25 6.25l1.25-1.25" />
  </>,
);

/** Aceite: círculo com visto. */
export const IconeAceite = criar(
  "Aceite",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M8.25 12.25l2.5 2.5 5-5.25" />
  </>,
);

/** Recusa: círculo com xis. */
export const IconeRecusa = criar(
  "Recusa",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M9.25 9.25l5.5 5.5" />
    <path d="M14.75 9.25l-5.5 5.5" />
  </>,
);

/** Lista de classificação: posições com linhas cada vez mais curtas. */
export const IconeClassificacao = criar(
  "Classificacao",
  <>
    <path d="M4 5.25l1.5-.75v4" />
    <circle cx="5" cy="13" r="1.25" />
    <circle cx="5" cy="18.5" r="1.25" />
    <path d="M9.5 6.5H20" />
    <path d="M9.5 13H17" />
    <path d="M9.5 18.5h4.5" />
  </>,
);

/** Relatório: folha com canto dobrado e barras. */
export const IconeRelatorio = criar(
  "Relatorio",
  <>
    <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
    <path d="M13.5 3v5.5H19" />
    <path d="M9 17.5v-2.5" />
    <path d="M12 17.5v-5" />
    <path d="M15 17.5v-3.5" />
  </>,
);

/** Calendário com um dia marcado. */
export const IconeCalendario = criar(
  "Calendario",
  <>
    <rect x="3.75" y="5" width="16.5" height="15.5" rx="2.5" />
    <path d="M3.75 10h16.5" />
    <path d="M8.5 3v4" />
    <path d="M15.5 3v4" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M8 17h.01" />
    <circle cx="16" cy="15.5" r="1.75" />
  </>,
);

/** Sino de aviso. */
export const IconeSino = criar(
  "Sino",
  <>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
    <path d="M10 21a2.25 2.25 0 0 0 4 0" />
    <path d="M12 3v2" />
  </>,
);

/** Filtro: funil. */
export const IconeFiltro = criar(
  "Filtro",
  <>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v.4a1.5 1.5 0 0 1-.4 1L14 13v5.25l-4 2V13L4.4 6.9a1.5 1.5 0 0 1-.4-1z" />
  </>,
);

export const IconeMais = criar(
  "Mais",
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);

export const IconeVoltar = criar(
  "Voltar",
  <>
    <path d="M19 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </>,
);

/** Sair: porta aberta com seta para fora. */
export const IconeSair = criar(
  "Sair",
  <>
    <path d="M13 4H6.5A2 2 0 0 0 4.5 6v12a2 2 0 0 0 2 2H13" />
    <path d="M10 12h10.5" />
    <path d="M17 8.5l3.5 3.5-3.5 3.5" />
  </>,
);

/** Auditoria: lupa sobre um registro. */
export const IconeAuditoria = criar(
  "Auditoria",
  <>
    <circle cx="10.5" cy="10.5" r="6.75" />
    <path d="M15.5 15.5l5 5" />
    <path d="M7.75 9h5.5" />
    <path d="M7.75 12h3.5" />
  </>,
);

/** Regras: dois controles deslizantes. */
export const IconeRegras = criar(
  "Regras",
  <>
    <path d="M4 7.5h8.5" />
    <path d="M17.5 7.5H20" />
    <circle cx="15" cy="7.5" r="2.5" />
    <path d="M4 16.5h2.5" />
    <path d="M11.5 16.5H20" />
    <circle cx="9" cy="16.5" r="2.5" />
  </>,
);

/** Usuários: duas pessoas. */
export const IconeUsuarios = criar(
  "Usuarios",
  <>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3 20c0-3.3 2.7-5.75 6-5.75s6 2.45 6 5.75" />
    <path d="M15.5 5.4a3.25 3.25 0 0 1 0 6.2" />
    <path d="M17.5 14.6c2 .75 3.5 2.6 3.5 5.4" />
  </>,
);

/* --- de apoio aos componentes ------------------------------------------ */

export const IconeFechar = criar(
  "Fechar",
  <>
    <path d="M6.5 6.5l11 11" />
    <path d="M17.5 6.5l-11 11" />
  </>,
);

export const IconeSeta = criar("Seta", <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />);

export const IconeAlerta = criar(
  "Alerta",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 7.75v5" />
    <path d="M12 16.25h.01" />
  </>,
);

export const IconeTelefone = criar(
  "Telefone",
  <>
    <rect x="6" y="2.75" width="12" height="18.5" rx="2.5" />
    <path d="M10.5 18h3" />
  </>,
);

export const IconeRepetir = criar(
  "Repetir",
  <>
    <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1" />
    <path d="M18 3.5v3.75h-3.75" />
    <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1" />
    <path d="M6 20.5v-3.75h3.75" />
  </>,
);

/** Catálogo, para a página do design system. */
export const ICONES = [
  { nome: "Escola", Icone: IconeEscola },
  { nome: "Professor", Icone: IconeProfessor },
  { nome: "Onda", Icone: IconeOnda },
  { nome: "Convocação", Icone: IconeConvocacao },
  { nome: "Prazo", Icone: IconePrazo },
  { nome: "Aceite", Icone: IconeAceite },
  { nome: "Recusa", Icone: IconeRecusa },
  { nome: "Classificação", Icone: IconeClassificacao },
  { nome: "Relatório", Icone: IconeRelatorio },
  { nome: "Calendário", Icone: IconeCalendario },
  { nome: "Sino", Icone: IconeSino },
  { nome: "Filtro", Icone: IconeFiltro },
  { nome: "Mais", Icone: IconeMais },
  { nome: "Voltar", Icone: IconeVoltar },
  { nome: "Sair", Icone: IconeSair },
  { nome: "Auditoria", Icone: IconeAuditoria },
  { nome: "Regras", Icone: IconeRegras },
  { nome: "Usuários", Icone: IconeUsuarios },
  { nome: "Telefone", Icone: IconeTelefone },
  { nome: "Alerta", Icone: IconeAlerta },
  { nome: "Repetir", Icone: IconeRepetir },
  { nome: "Fechar", Icone: IconeFechar },
] as const;
