import { defineConfig } from "oxfmt";

export default defineConfig({
  trailingComma: "all",
  printWidth: 120,
  quoteProps: "consistent",
  endOfLine: "lf",
  arrowParens: "always",
  sortImports: true,
  sortPackageJson: false,
  ignorePatterns: ["pnpm-lock.yaml", "**/CHANGELOG.md", ".chronus/changes/**/*.md"],
});
