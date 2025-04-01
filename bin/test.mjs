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
    compatibilityDate: "2024-09-23",
    compatibilityFlags: ["nodejs_compat"],
  });
  const request = await fetch(
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `${await miniflare.ready}doc`,
    { SENTRY_DSN: null, SENTRY_ENVIRONMENT: null },
    null,
  );
  await miniflare.dispose();
  if (request.status === 200) {
    const types = await openapiTS(await consumers.json(request.body));
    const printer = ts.createPrinter({});
    const resultFile = ts.createSourceFile(
      "test/api.d.ts",
      "",
      ts.ScriptTarget.Latest,
    );
    const result = types.map((t) => printer.printNode(
      ts.EmitHint.Unspecified,
      t,
      resultFile,
    )).join("\n\n");
    fs.writeFileSync(
      "test/api.d.ts",
      await prettier.format(result, { parser: "typescript" }),
    );
  }
}
cmd("vitest", [
  ...(!process.argv.slice(2).includes("-w") &&
  !process.argv.slice(2).includes("--watch")
    ? ["--run"]
    : []),
  ...process.argv.slice(2),
]);
