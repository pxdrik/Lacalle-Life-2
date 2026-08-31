import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // Unused code is dead code. It must fail the build, not warn.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `any` erases the guarantees the strict compiler is there to provide.
      "@typescript-eslint/no-explicit-any": "error",
      // Type-only imports must be marked so they erase cleanly.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  /**
   * The persistence boundary, enforced rather than documented.
   *
   * Only a feature's own `data/` folder may know that storage exists. Its
   * components, hooks, services and pages talk to that feature's repository
   * interface, which is what lets a remote implementation replace the local
   * one without touching anything above this line.
   */
  {
    files: ["src/features/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    // `data/` is the layer that implements the boundary. Tests wire real
    // implementations on purpose — see the note on the next block.
    ignores: ["src/features/*/data/**", "src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/core/storage", "@/core/storage/**", "idb", "idb/**"],
              message:
                "Persistence is reachable only through a feature repository. Import the repository interface from this feature's data/ folder instead.",
            },
          ],
        },
      ],
    },
  },

  /**
   * The dependency arrow, enforced.
   *
   * `composition/` is the top of the graph: it is the only module that knows
   * which implementation backs each interface. A feature importing it would
   * invert that and make the feature unusable without the whole app wired up.
   * Features declare how they receive a dependency; composition supplies it.
   */
  {
    files: ["src/features/**/*.{ts,tsx}", "src/design-system/**/*.{ts,tsx}"],
    /**
     * A test is the composition root of its own scenario: it wires real
     * implementations together precisely to prove they fit. Holding it to the
     * production boundary would force it to test through a mock instead, which
     * is the opposite of what it is for.
     */
    ignores: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/composition", "@/composition/**"],
              message:
                "The composition root supplies dependencies; it is never imported by what it wires. Expose a provider/context from this feature's data/ folder and let composition fill it.",
            },
            {
              // Blocks anything deeper than `@/features/<name>`, which is the
              // feature's `index.ts`. A feature publishes a surface and keeps
              // the rest private; reach past it and the two stop being
              // separable.
              group: ["@/features/*/*", "@/features/*/*/**"],
              message:
                "Import another feature through its index.ts, not its internals. If what you need is not exported there, decide whether it should be public or whether it belongs in core/.",
            },
          ],
        },
      ],
    },
  },

  /**
   * Maintenance scripts are command-line tools. `no-console` exists to stop a
   * stray log reaching a user's browser; here printing a report *is* the job.
   */
  {
    files: ["scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
    },
  },

  /**
   * The service worker is the one script here that ships unbundled and
   * untyped. It runs in its own global scope, so it cannot import from `src/`
   * and TypeScript never sees it — which left it as the single file in the
   * project with nothing checking it at all.
   *
   * `no-undef` with the service worker globals is the cheapest thing that
   * closes that: a typo in `caches` or `clients` would otherwise ship, and it
   * would fail while offline, which is precisely when nobody is watching a
   * console.
   */
  {
    files: ["public/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: globals.serviceworker,
    },
    rules: {
      "no-undef": "error",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "_Anteriores/**",
    "_docs/**",
    "_docs-auditoria/**",
    "_drafts/**",
    "_dados/**",
  ]),
]);
