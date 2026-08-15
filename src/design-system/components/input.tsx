import { cn } from "@/design-system/cn";

/**
 * O campo de texto, pela pág. 26.
 *
 * **44 px de altura em celular e desktop**, que a página fixa sem variação —
 * era 46 no celular e 40 na mesa, pela camada de densidade que os raios e as
 * alturas usavam. Um campo é o alvo mais tocado do app e a página o tirou dessa
 * variação de propósito: 44 é o mínimo de toque da pág. 48, e um desktop com
 * campo menor que o mínimo de toque não ganha nada em troca.
 *
 * A borda é Gray 300 e não a borda de card: a pág. 26 dá `#D1D5DB` ao input, e
 * a pág. 24 dá `#E5E7EB` ao card. Um controle de linha pede a borda mais forte
 * — é o que o separa da superfície em que ele está.
 *
 * **O foco muda a borda para o acento**, que é a metade da regra da pág. 26 que
 * carrega contraste (borda de acento contra branco mede 3,77:1, acima dos 3:1
 * que a pág. 48 pede de uma borda funcional). O anel de 3 px a 15% que a mesma
 * linha descreve **não** foi somado: o app já desenha o anel de foco de 2 px do
 * acento em `globals.css`, para todo elemento focalizável, e dois halos
 * concêntricos no mesmo controle é ruído — o segundo, a 15%, nem cumpriria
 * contraste sozinho.
 *
 * O tamanho do texto é a única coisa aqui que não vem da página. 16 px no
 * celular é uma restrição do iOS Safari, que dá zoom no viewport ao focar um
 * campo com fonte menor e joga o layout fora no meio da digitação. A pág. 26
 * pede 14; a mesa recebe 14.
 */
export function Input({
  className,
  ...props
}: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "h-(--input-h) w-full rounded-md border border-line-strong bg-surface",
        "px-(--input-px) text-ink",
        "text-base md:text-sm",
        "placeholder:text-ink-subtle",
        "transition-[border-color] duration-(--duration-micro) ease-out",
        "hover:border-ink-subtle focus:border-accent",
        // Erro: borda vermelha, e ela nunca vai sozinha — `Field` põe o ícone e
        // o texto ao lado, que é o "cor + ícone + texto" da pág. 27.
        "aria-[invalid=true]:border-danger",
        // Página 26: fundo #F3F4F6 e texto #D1D5DB. Não opacidade — a pág. 27
        // diz que opacidade não basta, e um campo a 45% ainda parece editável.
        "disabled:cursor-not-allowed disabled:border-line disabled:bg-muted",
        "disabled:text-line-strong disabled:placeholder:text-line-strong",
        className,
      )}
      {...props}
    />
  );
}
