import { access, readFile, writeFile } from "fs/promises";
import { globby } from "globby";
import type { ChronusHost, File, GlobOptions } from "./host.js";
import { normalizePath } from "./path-utils.js";

/**
 * Implementation of chronus host using node apis.
 */
export const NodechronusHost: ChronusHost = {
  async readFile(path): Promise<File> {
    const normalizedPath = normalizePath(path);
    const buffer = await readFile(normalizedPath);
    return {
      content: buffer.toString(),
      path: normalizedPath,
    };
  },

  async writeFile(path: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    await writeFile(normalizedPath, content);
  },

  async access(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    await access(normalizedPath);
  },

  async glob(pattern: string, options?: GlobOptions): Promise<string[]> {
    return globby(pattern, {
      cwd: options?.baseDir,
      onlyDirectories: options?.onlyDirectories,
      expandDirectories: false,
      ignore: options?.ignore,
    });
  },
};
