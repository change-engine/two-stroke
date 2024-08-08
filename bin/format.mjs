#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

cmd("eslint --fix");
cmd("prettier --write .");
