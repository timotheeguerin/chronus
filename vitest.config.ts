import { defineConfig, mergeConfig } from "vitest/config";

/**
 * Default Config
 */
export const defaultVitestConfig = defineConfig({
  test: {
    environment: "node",
    isolate: false,
    exclude: ["node_modules", "dist", ".temp"],
  },
});

export default mergeConfig(
  defaultVitestConfig,
  defineConfig({
    test: {
      projects: ["packages/*/vitest.config.ts"],
    },
  }),
);
