import type { Document } from "yaml";
import type { EmbeddedFile, TextFile } from "../file/index.js";

export interface YamlFile {
  readonly file: TextFile | EmbeddedFile;
  readonly doc: Document.Parsed;
  readonly data: unknown;
}
