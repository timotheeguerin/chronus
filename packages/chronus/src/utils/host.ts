import type { File } from "../file/types.js";

export interface ChronusHost {
  /**
   * Read a file.
   * @param path Path to the file.
   */
  readFile(path: string): Promise<File>;

  /**
   * Write the file.
   * @param path Path to the file.
   * @param content Content of the file.
   */
  writeFile(path: string, content: string): Promise<void>;
  /**
   * @param path
   */
  rm(path: string, options?: RmOptions): Promise<void>;

  mkdir(path: string, options?: MkdirOptions): Promise<void>;
  /**
   * Check if the file exists
   * @param path Path to the file.
   */
  access(path: string): Promise<void>;

  glob(pattern: string, options?: GlobOptions): Promise<string[]>;
}

export interface RmOptions {
  force?: boolean;
  recursive?: boolean;
}

export interface MkdirOptions {
  recursive?: boolean;
}

export interface GlobOptions {
  baseDir: string;
  onlyDirectories?: boolean;
  ignore?: string[];
}
