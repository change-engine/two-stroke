import { vitestConfig } from "./vitest.config.mjs";

// This repo's fixture app keeps its vars at the top level of wrangler.jsonc, with no `test` environment.
export default vitestConfig({ environment: "" });
