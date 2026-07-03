import { builtinModules } from "module";
import path from "path";

import { defineConfig } from "vite";

// Bundle EVERYTHING (all npm deps + workspace deps) into a single standalone file so the
// action can run directly from a git ref with no install step. Only Node builtins stay external.
// A single-entry `lib` build already emits one file (vite inlines dynamic imports), so no extra
// code-splitting option is required.
const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

export default defineConfig({
  build: {
    target: "node20",
    outDir: "dist",
    ssr: true,
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      fileName: () => "index.js",
      formats: ["es"],
    },
    rollupOptions: {
      external: (source: string): boolean => nodeBuiltins.has(source) || source.startsWith("node:"),
    },
  },
  ssr: {
    target: "node",
    noExternal: true,
  },
});
