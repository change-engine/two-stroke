#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

cmd("eslint --cache --fix");
cmd("prettier --cache --write .");
