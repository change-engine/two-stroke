#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";
import consumers from "stream/consumers";
import openapiTS from "openapi-typescript";
import prettier from "prettier";
import ts from "typescript";
import { unstable_startWorker } from "wrangler";

if (fs.existsSync("wrangler.jsonc")) {
  cmd("wrangler deploy --env=  --dry-run --outdir=dist");
  const worker = await unstable_startWorker({
    config: "wrangler.jsonc",
  });
  const request = await worker.fetch(
    "http://example.com/doc",
    { SENTRY_DSN: null, SENTRY_ENVIRONMENT: null },
    null,
  );
  await worker.dispose();
  if (request.status === 200) {
    const types = await openapiTS(await consumers.json(request.body));
    const printer = ts.createPrinter({});
    const resultFile = ts.createSourceFile("test/api.d.ts", "", ts.ScriptTarget.Latest);
    const result = types
      .map((t) => printer.printNode(ts.EmitHint.Unspecified, t, resultFile))
      .join("\n\n");
    fs.writeFileSync(
      "test/api.d.ts",
      await prettier.format(result, { parser: "typescript", printWidth: 100 }),
    );
  }
}
cmd("vitest", [
  ...(!process.argv.slice(2).includes("-w") && !process.argv.slice(2).includes("--watch")
    ? ["--run"]
    : []),
  ...process.argv.slice(2),
]);
