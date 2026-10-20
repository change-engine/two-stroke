#!/usr/bin/env node
"use strict";
import { createRequire } from "module";

// Vite is the project's dependency, not ours, so resolve it from the project.
const { loadConfigFromFile } = await import(
  createRequire(`${process.cwd()}/package.json`).resolve("vite")
);

const { config } = await loadConfigFromFile({ command: "build", mode: "production" });
const federation = config.plugins
  .flat(Infinity)
  .find((plugin) => plugin?.name === "module-federation-vite");

const missing = [];
for (const remote of Object.values(federation?._options.remotes ?? {})) {
  const url = new URL(remote.entry, `https://${process.env.DOMAIN}`);
  // oxlint-disable-next-line no-await-in-loop -- a handful of remotes, and the output stays in order
  const res = await fetch(url);
  // Unknown paths fall back to index.html with a 200, so check it is the entry script.
  if (res.ok && res.headers.get("Content-Type")?.startsWith("text/javascript")) {
    console.log(`✓ ${url}`);
  } else {
    console.error(`✗ ${url} (${res.status} ${res.headers.get("Content-Type")})`);
    missing.push(url);
  }
}
if (missing.length) process.exit(1);
