#!/usr/bin/env node
"use strict";
import fs from "fs";
import { cmd } from "../src/cmd.mjs";
import { basename } from "path";

const env = process.argv[2];
const release = process.argv[3];

fs.writeFileSync("src/release.ts", `export default "${release}";`);

cmd(`wrangler secret:bulk /dev/stdin --env ${env}`);
cmd(`wrangler deploy --env ${env} --outdir dist`);
