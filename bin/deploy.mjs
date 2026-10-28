#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";

const env = process.argv[2];
const release = process.argv[3];
// The app's Sentry project has its package's name. The working directory usually has it too, but not on every
// runner: Forgejo's host executor runs jobs in hostexecutor/.
const project = JSON.parse(fs.readFileSync("package.json", "utf8")).name;

fs.writeFileSync("src/release.ts", `export default "${release}";`);

cmd(`wrangler secret bulk /dev/stdin --env ${env}`);

cmd(`sentry-cli releases --org change-engine --project ${project} new ${release} --finalize`);

cmd(
  `sentry-cli releases --org change-engine --project ${project} set-commits ${release} --ignore-missing`,
);

cmd(`wrangler deploy --env ${env} --outdir dist`);

cmd(
  `sentry-cli sourcemaps --org change-engine --project ${project} upload --release="${release}" dist`,
);
