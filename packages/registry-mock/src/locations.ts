import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";
const REGISTRY_MOCK_PORT = process.env["CHRONUS_REGISTRY_MOCK_PORT"] || "4873";

const registry = () => join(__dirname, "../registry");
const configPath = () => join(__dirname, `../.temp/runtime-configs/runtime-config-${REGISTRY_MOCK_PORT}.yaml`);
let _storage: string;
const storage = () => {
  if (!_storage) {
    const content = readFileSync(configPath());
    _storage = (load(content.toString()) as { storage: string }).storage;
  }
  return _storage;
};

export { REGISTRY_MOCK_PORT, configPath, storage };
