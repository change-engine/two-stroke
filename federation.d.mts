/**
 * Module federation entry filename for a remote, `<name>_entry-<hash>.js`, where the hash covers
 * the installed major version of each shared library. Read from `node_modules` in the working
 * directory, so call it from a Vite config.
 */
export declare function federationEntry(name: string, shared: string[]): string;

/**
 * Vite plugin that sends each deep `@mui/material/*` import the package root re-exports through
 * the bare name, which federation shares, so the app runs one copy of @mui/material. `root` is the
 * source of `@mui/material/index.mjs`, read from `node_modules` in the working directory by
 * default, so call it from a Vite config. Applies to builds only.
 */
export declare function muiMaterialShare(root?: string): {
  name: string;
  apply: "build";
  enforce: "pre";
  resolveId: (source: string, importer?: string) => string | null;
  load: (id: string) => string | null;
};
