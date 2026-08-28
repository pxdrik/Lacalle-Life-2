import { ICONS } from "@/design-system/icons";

const PILLARS = [
  {
    icon: ICONS.diary,
    title: "Alimentação",
    text: "Registre o que comeu e monte suas dietas.",
  },
  {
    icon: ICONS.workouts,
    title: "Treino",
    text: "Crie treinos e registre cada série de verdade.",
  },
  {
    icon: ICONS.progress,
    title: "Evolução",
    text: "Veja o peso, o volume e o progresso ao longo do tempo.",
  },
] as const;

/**
 * "Tudo em um só lugar." Três colunas, um ícone cada, nenhum cartão em volta
 * — a pág. 20 do brand system chama isto de "acento escasso por construção",
 * e três blocos de cor cheia aqui já estourariam a proporção antes da tela
 * seguinte sequer começar.
 */
export function Pillars() {
  return (
    <section className="border-y border-line bg-muted/40">
      <div className="mx-auto max-w-(--content-max) px-4 py-14 md:px-6 md:py-16 lg:px-12">
        <p className="text-center text-sm text-ink-muted">
          Alimentação, treino e evolução, sem trocar de aplicativo entre eles.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-accent-surface text-accent-text">
                <Icon aria-hidden className="size-5" />
              </span>
              <h2 className="mt-4 font-semibold text-ink">{title}</h2>
              <p className="mt-1.5 text-sm text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
