import "@testing-library/jest-dom/vitest";
// Installs a spec-compliant IndexedDB on globalThis, so the real adapter is
// exercised rather than mocked away.
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom implements layout as a no-op and simply omits `scrollIntoView`, so any
// component that scrolls something into view throws on mount. Stubbed here
// rather than per test: it is a gap in the environment, not a fact about any
// one component.
Element.prototype.scrollIntoView = () => undefined;

// Same story for `<dialog>`: jsdom implements the element but none of the
// modal behaviour, so `showModal()` is missing entirely and anything that
// opens a dialog throws on mount. Stubbed to do the part that is observable
// from the outside — set `open`, and fire `close` on close, which is the event
// our own listener depends on.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

// jsdom has no IntersectionObserver at all — `useIncrementalReveal` would
// throw on mount without this. Inert on purpose: it never calls back, so a
// test never sees a list grow past its first page on its own. A test that
// needs to assert the growth behaviour installs its own controllable fake
// via `vi.stubGlobal`, scoped to that file.
class InertIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds: readonly number[] = [];
  observe() {
    // Never fires — see the class comment.
  }
  unobserve() {
    // Never fires — see the class comment.
  }
  disconnect() {
    // Never fires — see the class comment.
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver ??=
  InertIntersectionObserver as unknown as typeof IntersectionObserver;
