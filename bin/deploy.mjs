#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";
import { basename } from "path";

const env = process.argv[2];
const release = process.argv[3];

fs.writeFileSync("src/release.ts", `export default "${release}";`);

cmd(`wrangler secret:bulk /dev/stdin --env ${env}`);
cmd(
  `sentry-cli releases --org change-engine --project ${basename(process.cwd())} new ${release} --finalize`,
);

cmd(
  `sentry-cli releases --org change-engine --project ${basename(process.cwd())} set-commits ${release}`,
);

cmd(`wrangler deploy --env ${env} --outdir dist`);

cmd(
  `sentry-cli sourcemaps --org change-engine --project ${basename(process.cwd())} upload --release="${release}" dist`,
);
