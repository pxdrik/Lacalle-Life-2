"use client";

import { Component, type ReactNode } from "react";

import { Notice } from "./notice";

interface Props {
  /** What breaking here should not take down with it. */
  readonly children: ReactNode;
  /**
   * Shown in place of `children` once render throws.
   *
   * A sentence, not a stack trace — this is what a person sees, not a log.
   * Defaults to the generic form; a caller closer to the actual data (one row
   * of a list, say) can pass something more specific.
   */
  readonly message?: string;
}

interface State {
  readonly failed: boolean;
}

/**
 * Isolates a render crash to the subtree it happened in.
 *
 * **Why this exists at all**: the 2026-08-24 adversarial audit against
 * production found that one malformed `bodyEntries` record — reachable
 * through backup import, see `composition/backup-schemas.ts` — made
 * `formatDay` throw on `undefined.split("-")`, and nothing on the page caught
 * it. The whole of `/evolucao` went blank, including the workout history
 * beside it that had nothing wrong with its own data.
 *
 * Import validation is the real fix — a record shaped like that should never
 * reach IndexedDB again. This is the second line: something *else* unexpected
 * throwing during render of one section must not be indistinguishable, to the
 * person using the app, from the whole page being broken.
 *
 * **Deliberately not wrapped around the app, a route, or even a whole page.**
 * A boundary that wide turns every bug anywhere into the same blank screen —
 * which is the exact failure mode this is meant to end. Each call site wraps
 * only the one section whose own data might be the problem.
 *
 * A class component because React has no hook that can catch a render error
 * in its children — `getDerivedStateFromError` is still the only mechanism.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    // Not swallowed: a boundary that catches silently would turn "this record
    // is corrupt" into "this record quietly does not exist", which is a worse
    // kind of wrong. This is the one place in the app that is allowed to log
    // a raw error rather than a `describeDataError` message, because there is
    // no `DataError` here to describe — render threw, storage did not fail.
    console.error("ErrorBoundary caught a render failure:", error);
  }

  override render() {
    if (this.state.failed) {
      return (
        <Notice tone="danger" layout="block" title="Não foi possível exibir isto.">
          {this.props.message ??
            "Um dos registros não pôde ser mostrado. O resto da página continua funcionando."}
        </Notice>
      );
    }

    return this.props.children;
  }
}
