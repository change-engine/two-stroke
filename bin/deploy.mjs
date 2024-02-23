#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";
import { basename } from "path";

const env = process.argv[2];
const release = process.argv[3];

fs.writeFileSync("src/release.ts", `export default "${release}";`);

await cmd(`wrangler secret:bulk /dev/stdin --env ${env}`);
await cmd(
  `sentry-cli releases --org change-engine --project ${basename(process.cwd())} new ${release} --finalize`,
);

await cmd(
  `sentry-cli releases --org change-engine --project ${basename(process.cwd())} set-commits ${release}`,
);

await cmd(`wrangler deploy --env ${env} --outdir dist`);

await cmd(
  `sentry-cli sourcemaps --org change-engine --project ${basename(process.cwd())} upload --release="${release}" dist`,
);
