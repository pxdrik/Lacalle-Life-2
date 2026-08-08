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
