#!/usr/bin/env node
"use strict";
import { cmd } from "../src/cmd.mjs";

cmd("oxfmt");
cmd("oxlint --fix");
