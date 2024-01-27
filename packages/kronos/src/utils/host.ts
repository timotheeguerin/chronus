/**
 *
 */
export interface KronosHost {
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
}

export interface File {
  readonly content: string;
  readonly path: string;
}
