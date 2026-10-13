import { defineConfig } from "tsdown";

export default defineConfig({
  // `route.ts` must stay a standalone module on disk because Astro's
  // `injectRoute` takes a *file path*. `core` is a separate subpath export so
  // Worker code never pulls in the Node-only integration. The components ship
  // as source (`src/components`): the consuming project's Astro compiles them.
  entry: ["src/index.ts", "src/core.ts", "src/schema.ts", "src/route.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  dts: true,
  sourcemap: true,
  clean: true,
  outExtensions: () => ({ js: ".mjs", dts: ".d.mts" }),
  deps: {
    // Resolved by the integration's own Vite plugin inside the consuming Astro
    // project — it does not exist at build time here.
    neverBundle: ["virtual:astro-d1-reactions/config", /^astro/],
  },
});
