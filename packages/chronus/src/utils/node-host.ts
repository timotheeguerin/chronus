import { access, mkdir, readFile, rm, writeFile } from "fs/promises";
import { globby } from "globby";
import { createTextFile } from "../file/create-file.js";
import type { TextFile } from "../file/index.js";
import type { ChronusHost, GlobOptions, MkdirOptions, RmOptions } from "./host.js";
import { normalizePath } from "./path-utils.js";

/**
 * Implementation of chronus host using node apis.
 */
export const NodeChronusHost: ChronusHost = {
  async readFile(path): Promise<TextFile> {
    const normalizedPath = normalizePath(path);
    const buffer = await doIO(() => readFile(normalizedPath));
    return createTextFile(buffer.toString(), normalizedPath);
  },

  async writeFile(path: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    await doIO(() => writeFile(normalizedPath, content));
  },

  async rm(path: string, options: RmOptions): Promise<void> {
    const normalizedPath = normalizePath(path);
    await doIO(() => rm(normalizedPath, options));
  },

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    const normalizedPath = normalizePath(path);
    await doIO(() => mkdir(normalizedPath, options));
  },

  async access(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    await doIO(() => access(normalizedPath));
  },

  async glob(pattern: string | string[], options?: GlobOptions): Promise<string[]> {
    return globby(pattern, {
      cwd: options?.baseDir,
      onlyDirectories: options?.onlyDirectories,
      expandDirectories: false,
      ignore: options?.ignore,
    });
  },
};

async function doIO<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && "message" in e) {
      throw new NodeIOError(e.code as any, e.message as any);
    } else {
      throw e;
    }
  }
}

export type NodeIOErrorCode = "ENOENT" | "EEXIST" | "EISDIR" | "EACCES" | "EPERM" | "ELOOP" | "ENOTDIR" | "ENOTEMPTY";
export class NodeIOError extends Error {
  readonly code: NodeIOErrorCode;
  constructor(code: string, message: string) {
    super(message);
    this.code = code as any;
  }
}
