#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";

if (fs.existsSync("wrangler.jsonc")) {
  cmd("wrangler types --env-file /dev/null --strict-vars false --check");
}
cmd("oxfmt --check");
cmd("oxlint");
