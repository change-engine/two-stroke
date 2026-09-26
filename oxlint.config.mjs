import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "promise", "vitest"],
  options: {
    typeAware: true,
  },
  categories: {
    correctness: "error",
    suspicious: "warn",
    perf: "error",
    style: "warn",
  },
  rules: {
    /*
     * Serial by intent, in every case seen across the fleet: retry backoff, cursor
     * paging, D1 batch chunking, rate-limited API walks, try-each-key-until-one-works.
     * two-stroke's own request loop is three of them. Worth seeing, not worth gating on.
     */
    "no-await-in-loop": "warn",
    // Judge a wrapped comment by its first line, so the second can carry on the sentence.
    "capitalized-comments": ["warn", "always", { ignoreConsecutiveComments: true }],
    "no-map-spread": "off",
    "no-named-export": "off",
    "no-magic-numbers": "off",
    "consistent-indexed-object-style": "off",
    "id-length": "off",
    "no-await-expression-member": "off",
    "max-nested-calls": "off",
    "sort-keys": "off",
    curly: "off",
    "switch-case-braces": "off",
    "vitest/require-hook": "off",
    "no-ternary": "off",
    "group-exports": "off",
    "exports-last": "off",
    "prefer-default-export": "off",
    "no-null": "off",
    "consistent-type-specifier-style": "off",
    "max-statements": "off",
    "consistent-type-imports": "error",
    "relative-url-style": ["error", "always"],
    "no-namespace": "off",
    "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    "func-style": "off",
    "sort-imports": [
      "error",
      {
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
      },
    ],
    "new-cap": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/avoid-new": "off",
    "prefer-await-to-then": "off",
    "max-params": "off",
    "no-underscore-dangle": "off",
    "no-nested-ternary": "off",
    "unicorn/no-nested-ternary": "off",
    "no-anonymous-default-export": "off",
    "no-continue": "off",
    "init-declarations": "off",
    "vitest/prefer-to-be-truthy": "off",
    "vitest/prefer-to-be-falsy": "off",
    "vitest/prefer-expect-assertions": "off",
    "vitest/prefer-importing-vitest-globals": "off",
    "vitest/no-importing-vitest-globals": "error",
    "vitest/prefer-describe-function-title": "off",
    "vitest/require-top-level-describe": "off",
    "vitest/max-expects": "off",
    "vitest/no-hooks": "off",
    "unicorn/number-literal-case": "off",
    "eslint/one-var": "off",
    "vitest/prefer-called-once": "off",
    // `toEqual` ignores keys written as `undefined`; `toStrictEqual` does not. Fixtures
    // spell those out on purpose, so the fix changes what a test asserts.
    "vitest/prefer-strict-equal": "off",
    // `vi.mock(import("x"))` does not type-check against vi.mock's overloads.
    "vitest/prefer-import-in-mock": "off",
    // A mock standing in for a whole module would restate that module's signatures.
    "vitest/require-mock-type-parameters": "off",
    // Assertion helpers are `assert` or named `expect…` (`expectRedirect`), so it
    // can see them; anything left over really asserts nothing.
    "vitest/expect-expect": ["warn", { assertFunctionNames: ["expect", "expect*", "assert"] }],
    // Route tests are titled by the request they make: "GET /thing", not "gET /thing".
    "vitest/prefer-lowercase-title": [
      "warn",
      { allowedPrefixes: ["GET", "POST", "PUT", "DELETE", "PATCH", "JWT"] },
    ],
  },
  overrides: [
    {
      files: ["*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        // Tests stash a method to restore it after stubbing. It is never called, so
        // `this` never matters.
        "unbound-method": "off",
        // A helper belongs next to the only test that uses it; hoisting it to module
        // scope saves nothing in a test run and puts it out of sight.
        "unicorn/consistent-function-scoping": "off",
      },
    },
    {
      files: ["*-definitions.ts"],
      rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-redundant-type-constituents": "off",
        "@typescript-eslint/no-duplicate-type-constituents": "off",
        "group-exports": "off",
        "exports-last": "off",
        "consistent-indexed-object-style": "off",
      },
    },
    {
      files: ["bin/*.mjs", "src/cmd.mjs"],
      rules: {
        "import/no-nodejs-modules": "off",
        "prefer-destructuring": "off",
      },
    },
  ],
});
