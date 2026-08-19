/**
 * The page-entry motion every `template.tsx` in the app shares — Sprint 8,
 * Fase 3.6.
 *
 * **This is not the LaCalle Reveal.** The circular mask the brief asked to
 * reconsider needs React's `<ViewTransition>` (or the raw
 * `document.startViewTransition`) to animate between two already-rendered
 * trees. Checked against what is actually installed here, not what a guide
 * claimed: `node_modules/react/package.json` pins `19.2.8`, a stable
 * release, and grepping the bundled `react` package for `ViewTransition`
 * turns up nothing — the export does not exist in this tree. The Next.js
 * guide that describes it assumes a React canary build; this project does
 * not have one, and installing one is an architecture change this sprint
 * does not have standing to make on its own. That is the real technical
 * reason the brief's fallback clause names: **kept `--animate-rise`.**
 *
 * `translate`, not `transform`, but the same CSS hazard applies: a non-`none`
 * `translate` establishes a new containing block for `position: fixed`
 * descendants for as long as it holds a value — including after the
 * animation ends, since `animation-fill-mode: both` freezes the keyframe's
 * final `translate: 0 0`, not `none`. Grepped for every `fixed` element in
 * the app: `Toast` and the nav chrome live in the root layout, outside any
 * `template.tsx`, so they never nest inside this wrapper. `RestTimerBar`
 * does not — it renders inside `/sessao/[id]`'s own content — which is why
 * that one route has no `template.tsx` and keeps the instant navigation it
 * has today. Not fixed, avoided: the safer engineering call when the fix
 * itself was not worth the risk of introducing a subtler bug during a
 * workout.
 *
 * `prefers-reduced-motion` needs nothing here — `globals.css` already caps
 * every animation to 120ms globally, this one included.
 */
export function PageTransition({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <div className="animate-rise">{children}</div>;
}
