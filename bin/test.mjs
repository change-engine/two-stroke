#!/usr/bin/env node
"use strict";
import ts from "@typescript/typescript6";
import fs from "fs";
import { Miniflare } from "miniflare";
import { format } from "oxfmt";
import path from "path";
import consumers from "stream/consumers";
import { cmd } from "../src/cmd.mjs";
import openapiTS from "../src/openapi-typescript.mjs";

if (fs.existsSync("wrangler.jsonc")) {
  cmd("wrangler deploy --env=  --dry-run --outdir=dist");
  const { config } = ts.parseConfigFileTextToJson(
    "wrangler.jsonc",
    fs.readFileSync("wrangler.jsonc", "utf8"),
  );
  const mainModule = `${path.basename(config.main, path.extname(config.main))}.js`;
  const moduleTypes = { ".js": "esm", ".mjs": "esm", ".cjs": "cjs", ".wasm": "wasm" };
  const modules = Object.fromEntries(
    fs
      .readdirSync("dist")
      .filter((file) => moduleTypes[path.extname(file)])
      .map((file) => [
        file,
        {
          type: moduleTypes[path.extname(file)],
          contents:
            path.extname(file) === ".wasm"
              ? new Uint8Array(fs.readFileSync(`dist/${file}`))
              : fs.readFileSync(`dist/${file}`, "utf8"),
        },
      ]),
  );
  const miniflare = new Miniflare({
    workers: [
      {
        config: {
          name: config.name,
          compatibilityDate: config.compatibility_date,
          compatibilityFlags: config.compatibility_flags,
          manifest: { mainModule, modules },
        },
      },
    ],
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
