#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

await cmd("prettier --write . !tsconfig.json");
