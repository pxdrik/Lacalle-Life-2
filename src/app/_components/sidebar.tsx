import Link from "next/link";

import { Signature } from "@/design-system/brand/signature";

import { AccountBlock, SidebarNav } from "./sidebar-nav";

/**
 * A coluna fixa do desktop.
 *
 * `lg` para cima, que é o 1024 da pág. 32. Abaixo disso ela vira o drawer que
 * `AppNav` abre, e abaixo de 768 a barra de abas assume. As três faixas mostram
 * os mesmos destinos, nas mesmas ordens: `SidebarNav` é uma só, e a barra de
 * abas leva os quatro diários com o resto atrás de "Mais".
 *
 * Fixa em vez de rolar com a página: o mapa não deve se mover enquanto você lê
 * o que ele aponta, e o app tem telas — o catálogo de exercícios tem 183 linhas
 * — em que rolar a navegação para fora do topo significa rolar de volta para
 * sair.
 *
 * A largura é 264 px, da pág. 31, e vem do token para que o `padding` do layout
 * que mantém o conteúdo livre da coluna leia o mesmo número. Eram 256, escritos
 * em dois lugares.
 */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-(--sidebar-w) flex-col border-r border-line bg-surface lg:flex">
      {/* A logo ocupa o topo da sidebar, com a mesma altura do header — pág.
          31. `--signature-h` já vale 22 px nesta faixa, então a altura vem do
          token e não de um número escrito aqui. */}
      <div className="flex h-(--header-h) shrink-0 items-center border-b border-line px-4">
        <Link href="/">
          <Signature />
        </Link>
      </div>

      <SidebarNav />
      <AccountBlock />
    </aside>
  );
}
