import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

export const REGISTRY_MOCK_PORT = process.env["CHRONUS_REGISTRY_MOCK_PORT"] || "4873";

export const registry = () => join(__dirname, "../registry");
export const configPath = () => join(__dirname, `../.temp/runtime-configs/runtime-config-${REGISTRY_MOCK_PORT}.yaml`);
let _storage: string;
export const storage = () => {
  if (!_storage) {
    const content = readFileSync(configPath());
    _storage = (load(content.toString()) as { storage: string }).storage;
  }
  return _storage;
};
