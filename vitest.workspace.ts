export default ["packages/*/vitest.config.ts"];

/**
 * Default Config
 */
export const defaultVitestConfig = {
  test: {
    environment: "node",
    isolate: false,
  },
};
