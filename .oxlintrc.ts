import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript"],
  categories: { correctness: "error" },
  options: { typeAware: true },
  ignorePatterns: ["**/dist/**", "**/.temp/**", "**/.astro/**"],
  rules: {
    "no-console": "warn",
    "prefer-const": "warn",
    "eqeqeq": ["warn", "always", { null: "ignore" }],
    "no-unused-vars": [
      "warn",
      {
        varsIgnorePattern: "^_",
        argsIgnorePattern: ".*",
        caughtErrorsIgnorePattern: ".*",
        ignoreRestSiblings: true,
      },
    ],
    "typescript/no-explicit-any": "off",
    "typescript/no-floating-promises": "warn",
  },
  overrides: [
    {
      files: ["**/*.test.ts"],
      plugins: ["vitest"],
      rules: {
        "vitest/no-focused-tests": "warn",
        "vitest/no-identical-title": "error",
        "vitest/no-commented-out-tests": "warn",
        "vitest/no-import-node-test": "warn",
        "vitest/require-local-test-context-for-concurrent-snapshots": "warn",
        "vitest/valid-describe-callback": "warn",
        "vitest/valid-expect": "warn",
        "vitest/expect-expect": [
          "error",
          {
            assertFunctionNames: [
              "expect",
              "ok",
              "strictEqual",
              "notStrictEqual",
              "deepStrictEqual",
              "notDeepStrictEqual",
              "equal",
              "notEqual",
              "deepEqual",
              "match",
              "throws",
              "rejects",
              "doesNotThrow",
              "doesNotReject",
              "findRightLocation",
            ],
          },
        ],
        "typescript/no-non-null-asserted-optional-chain": "off",
      },
    },
  ],
});
