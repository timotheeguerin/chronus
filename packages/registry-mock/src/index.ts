import { spawn, type SpawnOptions } from "child_process";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dump, load } from "js-yaml";
import { dirname, join } from "path";
import * as locations from "./locations.js";

const REGISTRY_MOCK_PORT = locations.REGISTRY_MOCK_PORT;

export function start(opts: SpawnOptions) {
  const verdaccioBin = require.resolve("verdaccio/bin/verdaccio");
  return spawn("node", [verdaccioBin, "--config", locations.configPath(), "--listen", REGISTRY_MOCK_PORT], opts);
}

export const getIntegrity = (pkgName: string, pkgVersion: string): string => {
  return JSON.parse(readFileSync(join(locations.storage(), pkgName, "package.json"), "utf8")).versions[pkgVersion].dist
    .integrity;
};

export { REGISTRY_MOCK_PORT };

async function tempdir(): Promise<string> {
  const uid = randomBytes(8).toString("hex");
  const path = join(process.cwd(), `.temp/tests/${uid}`);
  await mkdir(path, { recursive: true });
  return path;
}

export async function prepare() {
  const storage = await tempdir();
  const content = await readFile(join(locations.registry(), "config.yaml"));
  const config: any = load(content.toString());
  await mkdir(dirname(locations.configPath()), { recursive: true });
  await writeFile(
    locations.configPath(),
    dump({
      ...config,
      storage,
      uplinks: {
        npmjs: {
          url: process.env["PNPM_REGISTRY_MOCK_UPLINK"] || "https://registry.npmjs.org/",
          // performance improvements
          // https://verdaccio.org/docs/en/uplinks

          // avoid go to uplink is offline
          max_fails: 100,
          // default is 10 min, avoid hit the registry for metadata
          maxage: "30m",
          // increase threshold to avoid uplink is offline
          fail_timeout: "10m",
          // increase threshold to avoid uplink is offline
          timeout: "600s",
          // pass down to request.js
          agent_options: {
            keepAlive: true,
            maxSockets: 40,
            maxFreeSockets: 10,
          },
        },
      },
    }),
  );
}
