#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

await cmd("eslint --max-warnings=0 src");
await cmd("prettier --check . !tsconfig.json");
