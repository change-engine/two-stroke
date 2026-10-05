import type { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import type { UserConfig } from "vitest/config";

export interface VitestConfigOptions {
  /** Wrangler environment the tests run against. Defaults to `"test"`. */
  environment?: string;
  /** Extra Miniflare options, such as `serviceBindings`. */
  miniflare?: NonNullable<Parameters<typeof cloudflareTest>[0]>["miniflare"];
}

export declare function vitestConfig(options?: VitestConfigOptions): UserConfig;

declare const config: UserConfig;
export default config;
