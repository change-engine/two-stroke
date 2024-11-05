#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

cmd("wrangler deploy --dry-run --outdir=dist");
cmd("tsc --noEmit");
