#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";

if (fs.existsSync("wrangler.jsonc")) {
    cmd("wrangler types --check")
}
cmd("eslint --cache --max-warnings=0");
cmd("prettier --cache --check .");
