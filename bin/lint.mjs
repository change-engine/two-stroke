#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

cmd("eslint --max-warnings=0");
cmd("prettier --check .");
