import Link from "next/link";

import { Signature } from "@/design-system/brand/signature";
import { cn } from "@/design-system/cn";
import { buttonClasses } from "@/design-system/components/button";

/**
 * O cabeçalho da Landing Page, e só dela — `Sidebar`/`AppNav` não renderizam
 * em `/` (ver `RootLayout`), então esta tela precisa da própria navegação.
 *
 * Mesma assinatura da sidebar (`Signature`), no mesmo tamanho de cabeçalho
 * que o resto do app usa em `--header-h` na faixa acima do celular — uma
 * visitante que cria conta e cai em `/hoje` vê o mesmo símbolo no mesmo
 * lugar, não uma segunda marca.
 *
 * **No celular, só "Entrar"** (roadmap 8.19, 30/09/2026). Marca e os dois
 * botões não cabiam: a página rolava de lado em 10 das 15 combinações de
 * celular, 17px em 390px Padrão e 172px em 320px Confortável. Medido em
 * 320px, marca + "Entrar" ocupa no máximo 261 dos 288px (Confortável), e
 * nenhuma versão com os dois cabe. "Criar minha conta" continua logo abaixo,
 * como botão principal do hero e no fim da página, e volta aqui a partir de
 * `sm`: no celular a primeira dobra tinha dois botões principais, e o
 * brandbook pede um por tela.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-(--content-max) items-center justify-between px-4 md:h-(--header-h) md:px-6 lg:px-12">
        <Link href="/" aria-label="LaCalle Life">
          <Signature height={20} />
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/entrar" className={buttonClasses("ghost", "sm")}>
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className={cn(buttonClasses("primary", "sm"), "hidden sm:inline-flex")}
          >
            Criar minha conta
          </Link>
        </div>
      </div>
    </header>
  );
}
