#!/usr/bin/env node
"use strict";
import fs from "fs";
import { Miniflare } from "miniflare";
import openapiTS from "openapi-typescript";
import { format } from "oxfmt";
import consumers from "stream/consumers";
import ts from "@typescript/typescript6";
import { cmd } from "../src/cmd.mjs";

if (fs.existsSync("wrangler.jsonc")) {
  cmd("wrangler deploy --env=  --dry-run --outdir=dist");
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  const miniflare = new Miniflare({
    modules: true,
    scriptPath: "dist/index.js",
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
  });
  const request = await fetch(`${await miniflare.ready}doc`);
  await miniflare.dispose();
  if (request.status === 200) {
    const types = await openapiTS(await consumers.json(request.body));
    const printer = ts.createPrinter({});
    const resultFile = ts.createSourceFile("test/api.d.ts", "", ts.ScriptTarget.Latest);
    const result = types
      .map((t) => printer.printNode(ts.EmitHint.Unspecified, t, resultFile))
      .join("\n\n");
    fs.writeFileSync(
      "test/api.d.ts",
      (await format("test/api.d.ts", result, { parser: "typescript", printWidth: 100 })).code,
    );
  }
}
cmd("vitest", [
  ...(!process.argv.slice(2).includes("-w") && !process.argv.slice(2).includes("--watch")
    ? ["--run"]
    : []),
  ...process.argv.slice(2),
]);
