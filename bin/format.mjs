#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

cmd("prettier --write . !tsconfig.json !test/api.d.ts");
