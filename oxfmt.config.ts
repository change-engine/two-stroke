import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: {
    newlinesBetween: false,
    groups: [
      ["value-builtin", "value-external"],
      ["value-internal", "value-parent", "value-sibling", "value-index"],
      { newlinesBetween: true },
      "type-import",
      "unknown",
    ],
  },
  ignorePatterns: ["worker-configuration.d.ts", "wrangler.jsonc"],
});
