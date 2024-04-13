import type { Document } from "yaml";
import type { File } from "../file/index.js";

export interface YamlFile {
  readonly file: File;
  readonly doc: Document.Parsed;
  readonly data: unknown;
}
