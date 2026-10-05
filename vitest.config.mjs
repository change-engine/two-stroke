import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
    }),
  ],
  test: {
    globals: true,
    testTimeout: 30_000,
    // Claude Code checks out other branches here; their tests are not this project's.
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
  },
});
