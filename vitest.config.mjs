import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { configDefaults, defineConfig } from "vitest/config";

export function vitestConfig({ environment = "test", miniflare } = {}) {
  return defineConfig({
    plugins: [
      cloudflareTest({
        wrangler: {
          configPath: "./wrangler.jsonc",
          environment,
        },
        miniflare,
      }),
    ],
    test: {
      // A log from another I/O context (queue handler, waitUntil) can deadlock the run after the
      // last test: https://github.com/cloudflare/workers-sdk/issues/15719
      disableConsoleIntercept: true,
      globals: true,
      testTimeout: 30_000,
      // Claude Code checks out other branches here; their tests are not this project's.
      exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
    },
  });
}

export default vitestConfig();
