import { muiMaterialShare } from "../federation.mjs";

// The shape of @mui/material's index.mjs
const root = `import * as colors from "./colors/index.mjs";
export { colors };
export * from "./styles/index.mjs";
export { default as Tabs } from "./Tabs/index.mjs";
export * from "./Tabs/index.mjs";
`;

describe("muiMaterialShare", () => {
  const plugin = muiMaterialShare(root);
  const lab = "/app/node_modules/.pnpm/@mui+lab@9/node_modules/@mui/lab/TabList/TabList.mjs";

  it("sends a deep import of a component through the bare name, with its default", () => {
    const id = plugin.resolveId("@mui/material/Tabs", lab);
    expect(id).toBe("\0mui-material-share:Tabs");
    expect(plugin.load(id!)).toBe(
      'export * from "@mui/material";\nexport { Tabs as default } from "@mui/material";',
    );
  });

  it("sends a deep import with no default through the bare name", () => {
    const id = plugin.resolveId("@mui/material/styles", "/app/src/theme.ts");
    expect(plugin.load(id!)).toBe('export * from "@mui/material";');
  });

  it("leaves alone what the root doesn't re-export, the bare name, and material's own files", () => {
    expect(plugin.resolveId("@mui/material/colors", lab)).toBeNull();
    expect(plugin.resolveId("@mui/material", lab)).toBeNull();
    expect(
      plugin.resolveId(
        "@mui/material/Tabs",
        "/app/node_modules/.pnpm/@mui+material@9/node_modules/@mui/material/index.mjs",
      ),
    ).toBeNull();
    expect(plugin.load("/app/src/theme.ts")).toBeNull();
  });

  it("fails when the root's layout changes", () => {
    expect(() => muiMaterialShare('export * from "./index.js";')).toThrow(/can't read/);
  });
});
