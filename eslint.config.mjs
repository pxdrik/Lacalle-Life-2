import { defineConfig, globalIgnores } from "eslint/config";
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
    ignores: ["src/features/*/data/**"],
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

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
