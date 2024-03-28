#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

cmd("eslint --max-warnings=0 src");
cmd("prettier --check . !tsconfig.json !test/api.d.ts");
