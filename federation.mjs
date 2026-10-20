import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// The name changes whenever a shared library changes major, so the host keeps loading the old
// entry until it is released with the same majors.
export function federationEntry(name, shared) {
  const majors = shared
    .toSorted()
    .map((pkg) => {
      const { version } = JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, "utf8"));
      return `${pkg}@${version.split(".")[0]}`;
    })
    .join(",");
  return `${name}_entry-${createHash("sha256").update(majors).digest("hex").slice(0, 8)}.js`;
}
