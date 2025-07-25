#!/usr/bin/env node
"use strict";

import fs from "fs";
import { cmd } from "../src/cmd.mjs";
import mime from "mime";

const entryOrRest = process.argv[2];
const entry = process.argv[3];

const ents = await fs.promises.readdir("dist", { withFileTypes: true, recursive: true });
const files = await Promise.all(
  ents
    .filter((ent) => ent.isFile())
    .filter((ent) =>
      entryOrRest == "entry" ? ent.name === entry : ent.name !== entry,
    )
    .map((ent) => {
      const type = mime.getType(`${ent.parentPath}/${ent.name}`);
      const key = `${ent.parentPath.substring(4)}/${ent.name}`;
      return (async () => ({
        key: ent.name === entry ? `${process.env.DOMAIN}${key}` : key,
        value: (await fs.promises.readFile(`${ent.parentPath}/${ent.name}`)).toString(
          "base64",
        ),
        base64: true,
        metadata: {
          "Content-Type":
            type === "text/html"
              ? "text/html;charset=utf-8"
              : type === "text/javascript"
                ? "text/javascript;charset=utf-8"
                : type,
          "Cache-Control":
            ent.name === entry ? "nocache" : "max-age=31536000, immutable",
        },
      }))();
    }),
);

fs.writeFileSync(`dist/bulk_${process.argv[2]}.json`, JSON.stringify(files));

cmd(
  `wrangler kv bulk put dist/bulk_${process.argv[2]}.json --remote --namespace-id ${process.env.NAMESPACE}`,
);
