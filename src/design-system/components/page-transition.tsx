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
 * the app: `Toast` is a sibling of `{children}` inside `ToastProvider`
 * (root layout), never a descendant of it, so it never nests inside this
 * wrapper regardless of what any route does. `Sidebar`/`AppNav` are the
 * same story one level down — siblings of `{children}` inside
 * `(app)/layout.tsx`, not wrapped by it.
 *
 * **This second guarantee broke once, silently, and is why it is spelled out
 * here rather than left implicit.** Before the Route Group split, the nav
 * chrome lived directly in the root layout and there was exactly one
 * `template.tsx`, at the root — an easy invariant to state and to keep.
 * Moving the chrome into `(app)/layout.tsx` (so the Landing page could stop
 * carrying it) put it one segment below where root `template.tsx` wraps,
 * which is `{children}` of the *root* layout — meaning `(app)/layout.tsx`'s
 * entire output, `Sidebar` included, became a descendant of this component's
 * `translate` div. `position: fixed` no longer meant "pinned to the
 * viewport", it meant "pinned to whatever box that div happened to be" —
 * visibly wrong only on a route whose content was shorter than the
 * viewport, which is why it shipped unnoticed. The fix: no `template.tsx`
 * at the root at all. Each route that wants the transition gets its own —
 * `(app)/hoje/template.tsx`, `(app)/exercicios/template.tsx`, one per
 * `(auth)` route, and the ones already sitting under `dietas/`, `treinos/`,
 * `evolucao/`, `alimentos/`, `perfil/`, `diario/` from before — all nested
 * *below* `(app)/layout.tsx`'s own `<Sidebar />`, never above it. The
 * Landing page, at `src/app/page.tsx`, has no folder of its own to hold a
 * `template.tsx`, so it wraps its own JSX in `<PageTransition>` directly —
 * safe, because nothing in it is `position: fixed` (`LandingHeader` is
 * `sticky`, which this hazard does not touch).
 *
 * `RestTimerBar` is the other side of the same check: it renders inside
 * `/sessao/[id]`'s own content, which is why that one route still has no
 * `template.tsx` — at any level — and keeps the instant navigation it has
 * today. Not fixed, avoided: the safer engineering call when the fix itself
 * was not worth the risk of introducing a subtler bug during a workout.
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
