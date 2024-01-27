import { defineConfig, mergeConfig } from "vitest/config";
import { defaultVitestConfig } from "../../vitest.workspace";

export default mergeConfig(defaultVitestConfig, defineConfig({}));
