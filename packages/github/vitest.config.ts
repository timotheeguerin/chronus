import { defineConfig, mergeConfig } from "vitest/config";
import { defaultVitestConfig } from "../../vitest.workspace.js";

export default mergeConfig(defaultVitestConfig, defineConfig({}));
