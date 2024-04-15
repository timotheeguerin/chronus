import { builtinModules } from "module";
import path from "path";
import { defineConfig } from "vite";

const externals = new Set([...builtinModules, "globby"]);
export default defineConfig({
  build: {
    target: "node20",
    lib: {
      entry: path.resolve(__dirname, "src/cli.ts"),
      fileName: "cli",
      formats: ["es"],
    },
    rollupOptions: {
      external: (source: string): boolean => {
        return externals.has(source) || source.startsWith("node:");
      },
    },
  },
  ssr: {
    target: "node",
  },
});
