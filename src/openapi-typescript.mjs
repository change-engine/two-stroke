import { registerHooks } from "node:module";

// Openapi-typescript needs the TypeScript 6 JS API (ts.factory), which TypeScript 7 no longer
// ships. Redirect its `typescript` import to @typescript/typescript6, resolved from two-stroke's
// own dependencies so this works however two-stroke is installed.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "typescript" && context.parentURL?.includes("/openapi-typescript/")) {
      return nextResolve("@typescript/typescript6", { ...context, parentURL: import.meta.url });
    }
    return nextResolve(specifier, context);
  },
});

export default (await import("openapi-typescript")).default;
