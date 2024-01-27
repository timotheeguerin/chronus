import type { KronosHost } from "../utils/host.js";

export interface TestHost {
  host: KronosHost;
}

export function createTestHost(files: Record<string, string> = {}): TestHost {
  const fs: Record<string, string> = files;
  const host: KronosHost = {
    readFile: (path: string) => {
      const content = fs[path];
      return Promise.resolve({ path, content });
    },
    writeFile: (path: string, content: string) => {
      fs[path] = content;
      return Promise.resolve();
    },
  };
  return {
    host,
  };
}
