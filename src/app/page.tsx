import { ThemeToggle } from "@/design-system/theme/theme-toggle";

/**
 * The home surface stays this bare until there is something real to put on
 * it. Navigation appears when there are destinations; a dashboard appears
 * when there is data. Scaffolding either one now would be decoration.
 */
export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight">
          Lacalle Life
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-6 pt-16 pb-24 sm:pt-28">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Monte dietas. Monte treinos. Acompanhe sua evolução.
        </h1>
        <p className="mt-6 text-lg text-ink-muted">Nada além disso.</p>
      </main>
    </div>
  );
}
