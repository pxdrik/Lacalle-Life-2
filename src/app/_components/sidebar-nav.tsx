"use client";

import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/design-system/cn";
import { ICONS } from "@/design-system/icons";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

/**
 * Os destinos, em dois grupos.
 *
 * A pág. 31 permite no máximo três grupos de navegação, e a lista plana de oito
 * links que estava aqui era zero: uma coluna de oito palavras em que "Evolução"
 * e "Exercícios" pareciam a mesma categoria de coisa. Não são.
 *
 * A divisão é a que o app já tinha implícita na barra de abas do celular, que
 * separa quatro destinos diários de um "Mais" com o resto: **o que você abre no
 * dia** contra **o que você consulta enquanto planeja**. Uma dieta é escrita uma
 * vez por mês e os dois catálogos são navegados montando treino ou refeição.
 *
 * Perfil não está em nenhum dos dois: ele é o bloco de conta ancorado na base,
 * que é onde a pág. 31 o põe.
 *
 * ---
 *
 * **Nada aqui recebe um callback de "navegou".** O drawer precisa fechar quando
 * alguém escolhe um destino, e a primeira versão disto passava `onNavigate` para
 * cada link. Fechar no `pathname` cobre mais pelo mesmo preço: o botão de voltar
 * do navegador, um link dentro do conteúdo e uma navegação programática também
 * fecham, e nenhum deles chamaria um `onClick`.
 */
const GROUPS: readonly {
  title: string;
  links: readonly { href: Route; label: string; icon: LucideIcon }[];
}[] = [
  {
    title: "Principal",
    links: [
      { href: "/", label: "Hoje", icon: ICONS.today },
      { href: "/diario", label: "Diário", icon: ICONS.diary },
      { href: "/treinos", label: "Treinos", icon: ICONS.workouts },
      { href: "/dietas", label: "Dietas", icon: ICONS.diets },
      { href: "/evolucao", label: "Evolução", icon: ICONS.progress },
    ],
  },
  {
    title: "Catálogo",
    links: [
      { href: "/exercicios", label: "Exercícios", icon: ICONS.exercises },
      { href: "/alimentos", label: "Alimentos", icon: ICONS.foods },
    ],
  },
];

/** O home é prefixo de toda outra rota, então é o único caso exato. */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * A receita de um item, e ela é uma só para os oito.
 *
 * Altura 40, raio 12, e o estado ativo em acento 50 + texto acento + barra de
 * 3 px — a receita literal da pág. 31. Substitui o preenchimento sólido de
 * verde que estava aqui: um bloco de acento por item de navegação é exatamente
 * o que a pág. 20 chama de acento dominante, e a barra diz "selecionado" com
 * **forma** além de cor, que é o que a pág. 48 exige de todo estado.
 */
function item(active: boolean): string {
  return cn(
    "relative flex h-10 items-center gap-3 rounded-md pr-3 pl-4",
    "text-sm transition-colors duration-(--duration-micro) ease-out",
    active
      ? "bg-accent-surface font-medium text-accent-text"
      : "text-ink-muted hover:bg-muted hover:text-ink",
  );
}

function Marker() {
  return (
    <span
      aria-hidden
      className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-accent"
    />
  );
}

/**
 * O conteúdo da navegação, sem a casca.
 *
 * Separado porque ele aparece em duas superfícies: a coluna fixa de 1024 px
 * para cima e o drawer sobreposto entre 768 e 1023, que a pág. 31 exige. As
 * duas mostram exatamente a mesma coisa — se divergirem, o app passa a ter dois
 * mapas de si mesmo dependendo da largura da janela.
 */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex-1 overflow-y-auto p-3">
      {GROUPS.map((group, index) => (
        <div key={group.title} className={cn(index > 0 && "mt-6")}>
          {/* Título de grupo: 10 px Bold, tracking +12% — pág. 31. Caixa alta,
              que a pág. 16 permite exatamente aqui, em labels e eyebrows. */}
          <h2 className="px-4 pb-2 text-[0.625rem] font-bold text-ink-subtle uppercase [letter-spacing:0.12em]">
            {group.title}
          </h2>

          <ul className="space-y-1">
            {group.links.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={item(active)}
                  >
                    {active && <Marker />}
                    <Icon aria-hidden className="size-5 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * O bloco de conta, ancorado na base e separado por borda — pág. 31.
 *
 * Perfil deixou de ser o oitavo item de uma lista de oito e virou isto, que é
 * onde a página o põe. O seletor de tema fica junto porque é a outra
 * preferência da conta, e as duas ocupam a linha que a pág. 31 reserva ao
 * rodapé da coluna.
 */
export function AccountBlock() {
  const pathname = usePathname();
  const active = isActive(pathname, "/perfil");
  const Icon = ICONS.profile;

  return (
    <div className="shrink-0 border-t border-line p-3">
      <Link
        href="/perfil"
        aria-current={active ? "page" : undefined}
        className={item(active)}
      >
        {active && <Marker />}
        <Icon aria-hidden className="size-5 shrink-0" />
        Perfil
      </Link>

      <div className="mt-2 px-1">
        <ThemeToggle />
      </div>
    </div>
  );
}
