import { readFile } from "fs/promises";
import type { File, KronosHost } from "./host.js";
import { normalizePath } from "./path-utils.js";

/**
 * Implementation of kronos host using node apis.
 */
export const NodeKronosHost: KronosHost = {
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
    await this.writeFile(normalizedPath, content);
  },
};
