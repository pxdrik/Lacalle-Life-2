/**
 * The home surface stays this bare until there is something real to put on
 * it. A dashboard appears when there is data to summarise; scaffolding one
 * now would be decoration.
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-16 pb-24 sm:pt-24">
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Monte dietas. Monte treinos. Acompanhe sua evolução.
      </h1>
      <p className="mt-6 text-lg text-ink-muted">Nada além disso.</p>
    </main>
  );
}
