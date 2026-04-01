#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";

if (fs.existsSync("wrangler.jsonc")) {
  const devVarsFiles = fs.globSync("**/.dev.vars");
  const backed = [];

  for (const file of devVarsFiles) {
    const tmp = file + ".bak.bak";
    fs.renameSync(file, tmp);
    backed.push({ original: file, tmp });
  }

  try {
    cmd("wrangler types --strict-vars false");
  } finally {
    for (const { original, tmp } of backed) {
      fs.renameSync(tmp, original);
    }
  }
}
cmd("wrangler deploy --env=  --dry-run --outdir=dist");
cmd("tsc --noEmit");
