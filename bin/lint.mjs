#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

cmd("eslint --cache --max-warnings=0");
cmd("prettier --cache --check .");
