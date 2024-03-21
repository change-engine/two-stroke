#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";
import consumers from "stream/consumers";
import openapiTS from "openapi-typescript";
import { Miniflare } from "miniflare";

if (fs.existsSync("wrangler.toml")) {
  await cmd("wrangler deploy --dry-run --outdir=dist");
  const miniflare = new Miniflare({
    modules: true,
    scriptPath: "dist/index.js",
  });
  const request = await fetch(
    `${await miniflare.ready}doc`,
    { SENTRY_DSN: null, SENTRY_ENVIRONMENT: null },
    null,
  );
  const types = await openapiTS(await consumers.json(request.body));
  await miniflare.dispose();
  fs.writeFileSync("test/api.d.ts", types);
}
await cmd("vitest --globals --no-file-parallelism", [
  ...(!process.argv.slice(2).includes("-w") &&
  !process.argv.slice(2).includes("--watch")
    ? ["--run"]
    : []),
  ...process.argv.slice(2),
]);
