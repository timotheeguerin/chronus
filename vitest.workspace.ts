import { defineConfig } from "vitest/config";

export default ["packages/*/vitest.config.ts"];

/**
 * Default Config
 */
export const defaultVitestConfig = defineConfig({
  test: {
    environment: "node",
    isolate: false,
  },
});
