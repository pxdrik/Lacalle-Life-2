"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Signature } from "@/design-system/brand/signature";
import { Dialog } from "@/design-system/components/dialog";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

import { BottomNav } from "./bottom-nav";
import { AccountBlock, SidebarNav } from "./sidebar-nav";

/**
 * O cabeçalho abaixo de 1024 px, e o drawer que ele abre.
 *
 * A pág. 32 dá três faixas e este arquivo cobre duas: abaixo de 768 a navegação
 * é a barra de abas, e entre 768 e 1023 é um **drawer sobreposto**, que é o que
 * a pág. 31 manda a sidebar virar nessa largura. De 1024 em diante `Sidebar`
 * assume e nada aqui é renderizado.
 *
 * **A fileira de links saiu.** Ela mostrava os oito destinos numa linha que
 * rolava de lado, e a pág. 30 limita a navegação primária do header a cinco
 * itens antes de exigir um "Mais". Rolagem lateral no topo da tela é a pior
 * forma possível de esconder um destino: nada indica que ela existe, e o gesto
 * fica no canto mais difícil de alcançar com uma mão. O drawer mostra os oito
 * de uma vez, agrupados, com o mesmo componente da sidebar — que é o que
 * garante que o mapa do app não mude de forma conforme a largura da janela.
 *
 * O header não recebe sombra: a separação é a borda de 1 px da pág. 30.
 */
export function AppNav() {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);

  // Fecha ao chegar em algum lugar. Preso ao `pathname` e não a um `onClick`
  // por link: assim o botão de voltar do navegador, um link dentro do conteúdo
  // e uma navegação programática também fecham o drawer.
  //
  // Ajuste de estado durante o render, que é a alternativa documentada do React
  // ao efeito — e a mesma técnica que `GramsField` usa. Um efeito aqui chamaria
  // `setState` de forma síncrona depois de toda navegação, inclusive as 99% em
  // que o drawer nem estava aberto.
  if (shownFor !== pathname) {
    setShownFor(pathname);
    if (drawer) setDrawer(false);
  }

  return (
    <header className="border-b border-line bg-surface lg:hidden">
      <div className="mx-auto flex h-(--header-h) w-full max-w-(--content-max) items-center gap-4 px-4 md:px-6">
        {/* Só na faixa do drawer. Abaixo de 768 a barra de abas é a navegação,
            e um segundo caminho para a mesma coisa é a "navegação duplicada"
            que a pág. 31 proíbe. */}
        <button
          type="button"
          onClick={() => {
            setDrawer(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={drawer}
          aria-label="Abrir navegação"
          className="-ml-2 hidden size-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-(--duration-micro) ease-out hover:bg-muted hover:text-ink md:flex"
        >
          <Menu aria-hidden className="size-5" />
        </button>

        {/* A assinatura completa — símbolo + "LaCalle" + qualificador — que é a
            forma obrigatória dentro de um produto (pág. 14). O que estava aqui
            era só o wordmark, porque o símbolo não existia.

            `Signature` lê `--signature-h`, que vale 18 px neste cabeçalho e 22
            do tablet para cima, exatamente como a tabela da pág. 14 pede. E a
            logo é sempre o link para a home (pág. 30). */}
        <Link href="/hoje" className="shrink-0">
          <Signature />
        </Link>

        {/* Só abaixo de 768. Da faixa do drawer para cima o seletor de tema
            está no bloco de conta, junto de Perfil, que é onde a pág. 31 o
            põe — mostrá-lo nos dois seria o mesmo controle duas vezes. */}
        <div className="ml-auto md:hidden">
          <ThemeToggle />
        </div>
      </div>

      <BottomNav />

      <Dialog
        open={drawer}
        title="Navegação"
        placement="sheet-left"
        onClose={() => {
          setDrawer(false);
        }}
      >
        {/* As margens do corpo do Dialog são desfeitas: um drawer é a sidebar,
            e a sidebar encosta nas próprias bordas. */}
        <div className="-mx-5 -my-5 flex h-full flex-col">
          <SidebarNav />
          <AccountBlock />
        </div>
      </Dialog>
    </header>
  );
}
