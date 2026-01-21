import { defineConfig, mergeConfig } from "vitest/config";
import { defaultVitestConfig } from "../../vitest.config.js";

export default mergeConfig(defaultVitestConfig, defineConfig({}));
