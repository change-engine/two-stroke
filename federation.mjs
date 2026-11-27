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

const MUI_MATERIAL_SHARE = "\0mui-material-share:";

// Federation shares `@mui/material` by its bare name only. A deep import such as
// `@mui/material/Tabs`, which @mui/lab and MUI X use, bundles a second, local copy, and components
// that work together through React context crash when the halves come from different copies:
// `Tabs` from one can't provide for `Tab` from the other ("RovingTabIndexContext is missing").
// Sending each deep import the package root re-exports through the bare name leaves one copy,
// whichever app's the federation runtime picks.
export function muiMaterialShare(root) {
  let routes;
  // Read on first use: the dev server and Vitest load the same config but never run the plugin
  const read = () => {
    if (routes) return routes;
    const source = root ?? readFileSync("node_modules/@mui/material/index.mjs", "utf8");
    // `export * from "./Tabs/index.mjs";` and `export { default as Tabs } from "./Tabs/index.mjs";`
    const paths = new Set(
      Array.from(
        source.matchAll(/^export \* from "\.\/(\w+)\/index\.mjs";$/gm),
        ([, path]) => path,
      ),
    );
    const defaults = new Map(
      Array.from(
        source.matchAll(/^export \{ default as (\w+) \} from "\.\/(\w+)\/index\.mjs";$/gm),
        ([, name, path]) => [path, name],
      ),
    );
    // Fails the build if a new @mui/material lays out its root differently, instead of quietly
    // leaving every deep import local again
    if (!paths.has("Tabs") || defaults.get("Tabs") !== "Tabs") {
      throw new Error("muiMaterialShare: can't read the re-exports in @mui/material/index.mjs");
    }
    routes = { paths, defaults };
    return routes;
  };

  return {
    name: "mui-material-share",
    // The dev server pre-bundles dependencies, so their imports never reach `resolveId`
    apply: "build",
    enforce: "pre",
    buildStart() {
      read();
    },
    resolveId(source, importer) {
      const path = /^@mui\/material\/(\w+)$/.exec(source)?.[1];
      if (!path || !read().paths.has(path)) return null;
      // The root is built from @mui/material's own files, so leave their imports alone
      if (importer?.replaceAll("\\", "/").includes("/node_modules/@mui/material/")) return null;
      return MUI_MATERIAL_SHARE + path;
    },
    load(id) {
      if (!id.startsWith(MUI_MATERIAL_SHARE)) return null;
      const name = read().defaults.get(id.slice(MUI_MATERIAL_SHARE.length));
      return [
        `export * from "@mui/material";`,
        ...(name ? [`export { ${name} as default } from "@mui/material";`] : []),
      ].join("\n");
    },
  };
}
