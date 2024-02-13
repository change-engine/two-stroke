#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";
import consumers from "stream/consumers";
import openapiTS from "openapi-typescript";

if (fs.existsSync("wrangler.toml")) {
  await cmd("wrangler deploy --dry-run --outdir=dist");
  const app = await import(`${process.cwd()}/dist/index.js`);
  const request = await app.default.fetch(
    { url: "http://example.com/doc/", method: "GET" },
    { SENTRY_DSN: null, SENTRY_ENVIRONMENT: null },
    null,
  );
  const types = await openapiTS(await consumers.json(request.body));
  fs.writeFileSync("test/api.d.ts", types);
}
await cmd("vitest --globals --no-file-parallelism --coverage", [
  ...(!process.argv.slice(2).includes("-w") &&
  !process.argv.slice(2).includes("--watch")
    ? ["--run"]
    : []),
  ...process.argv.slice(2),
]);
