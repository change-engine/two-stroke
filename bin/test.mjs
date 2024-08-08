#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";
import consumers from "stream/consumers";
import openapiTS from "openapi-typescript";
import prettier from "prettier";
import ts from "typescript";
import { Miniflare } from "miniflare";

if (fs.existsSync("wrangler.toml")) {
  cmd("wrangler deploy --dry-run --outdir=dist");
  const miniflare = new Miniflare({
    modules: true,
    scriptPath: "dist/index.js",
  });
  const request = await fetch(
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `${await miniflare.ready}doc`,
    { SENTRY_DSN: null, SENTRY_ENVIRONMENT: null },
    null,
  );
  const types = await openapiTS(await consumers.json(request.body));
  await miniflare.dispose();
  const printer = ts.createPrinter({});
  const resultFile = ts.createSourceFile(
    "test/api.d.ts",
    "",
    ts.ScriptTarget.Latest,
  );
  const result = printer.printNode(
    ts.EmitHint.Unspecified,
    types[0],
    resultFile,
  );
  fs.writeFileSync(
    "test/api.d.ts",
    await prettier.format(result, { parser: "typescript" }),
  );
}
cmd("vitest --globals --no-file-parallelism --pool threads", [
  ...(!process.argv.slice(2).includes("-w") &&
  !process.argv.slice(2).includes("--watch")
    ? ["--run"]
    : []),
  ...process.argv.slice(2),
]);
