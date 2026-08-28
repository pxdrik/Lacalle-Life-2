import { Laptop, Smartphone } from "lucide-react";

import { cardSurface } from "@/design-system/components/card";

/**
 * A seção mais importante da página, por pedido explícito: a diferença entre
 * usar sem conta e usar com conta, sem dizer que a conta é obrigatória e sem
 * dizer que os dados locais sincronizam sozinhos sem ela.
 */
export function AccountSection() {
  return (
    <section className="border-y border-line bg-muted/40">
      <div className="mx-auto max-w-(--content-max) px-4 py-20 md:px-6 md:py-24 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-h2 font-bold text-ink">
            Comece agora. Sincronize quando quiser.
          </h2>
          <p className="mt-3 text-ink-muted">
            O LaCalle Life funciona direto no seu aparelho, sem precisar de
            conta. Criar uma conta é o que permite levar seus dados para outro
            dispositivo.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={cardSurface("default")}>
            <Smartphone aria-hidden className="size-6 text-ink-subtle" />
            <h3 className="mt-3 font-semibold text-ink">Sem conta</h3>
            <p className="mt-1.5 text-sm text-ink-muted">
              Seus dados ficam salvos neste dispositivo. Você pode usar o app
              inteiro assim, sem nunca criar uma conta.
            </p>
          </div>

          <div className={cardSurface("hero")}>
            <Laptop aria-hidden className="size-6 text-accent-text" />
            <h3 className="mt-3 font-semibold text-ink">Com conta</h3>
            <p className="mt-1.5 text-sm text-ink-muted">
              Seus dados podem ser sincronizados entre seus dispositivos,
              quando você quiser entrar na sua conta em outro aparelho.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
