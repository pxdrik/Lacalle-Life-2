import Link from "next/link";

import { buttonClasses } from "@/design-system/components/button";

/**
 * A primeira tela. Três frases e dois botões, nada mais — a pág. 20 do brand
 * system pede o acento escasso, e um hero cheio de blocos coloridos era
 * exatamente o que a V1 tinha e este não repete: sem gradiente sobre o texto,
 * sem sombra difusa, sem blob de fundo. `text-display` é o mesmo tamanho de
 * título que o resto do produto já usa, só que aqui é o único título da tela.
 *
 * **"Experimentar sem conta" fica discreto de propósito** — um link, não um
 * terceiro botão do mesmo peso dos outros dois. O pedido é claro sobre isto:
 * incentivar a conta, porque é ela que sincroniza, sem nunca dizer que a
 * conta é obrigatória.
 */
export function Hero() {
  return (
    <section className="mx-auto max-w-(--content-max) px-4 pt-16 pb-14 text-center md:px-6 md:pt-24 md:pb-20 lg:px-12">
      <h1 className="mx-auto max-w-3xl text-h1 font-bold text-balance text-ink md:text-display">
        Seu treino. Sua alimentação.{" "}
        <span className="text-accent-text">Sua evolução.</span>
      </h1>

      <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-ink-muted">
        Monte sua dieta, registre seus treinos e acompanhe seu progresso num
        só lugar, sem depender de três aplicativos diferentes.
      </p>

      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/cadastro" className={buttonClasses("primary", "lg")}>
          Criar minha conta
        </Link>
        <Link href="/entrar" className={buttonClasses("secondary", "lg")}>
          Entrar
        </Link>
      </div>

      <p className="mt-6 text-sm text-ink-subtle">
        Ou{" "}
        <Link
          href="/hoje"
          className="font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          experimente sem criar conta
        </Link>
        .
      </p>
    </section>
  );
}
