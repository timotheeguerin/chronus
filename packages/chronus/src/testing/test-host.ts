import micromatch from "micromatch";
import { createFile } from "../file/create-file.js";
import type { ChronusHost, GlobOptions, MkdirOptions, RmOptions } from "../utils/host.js";
import { getDirectoryPath } from "../utils/path-utils.js";

export interface TestHost {
  host: ChronusHost;
  readonly fs: Record<string, string>;
  addFile(path: string, content: string): void;
}

export function createTestHost(files: Record<string, string> = {}): TestHost {
  const fs: Record<string, string> = files;
  const host: ChronusHost = {
    readFile: (path: string) => {
      const content = fs[path];
      return Promise.resolve(createFile(content, path));
    },
    writeFile: (path: string, content: string) => {
      fs[path] = content;
      return Promise.resolve();
    },
    rm: (path: string, options?: RmOptions) => {
      if (options?.recursive) {
        for (const key of Object.keys(fs)) {
          if (key.startsWith(path)) {
            delete fs[key];
          }
        }
      } else {
        delete fs[path];
      }
      return Promise.resolve();
    },
    mkdir: (_: string, _options?: MkdirOptions) => Promise.resolve(),
    access: (path: string) => {
      return path in fs ? Promise.resolve() : Promise.reject(new Error(`VFS: File ${path} does not exist`));
    },
    glob: (pattern: string, options?: GlobOptions) => {
      const baseDir = (options?.baseDir ?? "") + "/";
      const filesInBaseDir = Object.keys(fs)
        .filter((x) => x.startsWith(baseDir))
        .map((x) => x.substring(baseDir.length));

      const content = new Set<string>();

      for (const file of filesInBaseDir) {
        let current = file;
        while (current !== getDirectoryPath(current)) {
          content.add(current);
          current = getDirectoryPath(current);
        }
      }
      return Promise.resolve([...content].filter((x) => micromatch.isMatch(x, pattern)));
    },
  };
  return {
    host,
    fs,
    addFile: (path: string, content: string) => {
      fs[path] = content;
    },
  };
}
