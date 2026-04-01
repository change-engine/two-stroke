#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";

if (fs.existsSync("wrangler.jsonc")) {
    cmd("wrangler types --strict-vars false")
}
cmd("wrangler deploy --env=  --dry-run --outdir=dist");
cmd("tsc --noEmit");
