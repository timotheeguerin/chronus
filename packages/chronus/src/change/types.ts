import type { ChangeKindResolvedConfig } from "../config/types.js";
import type { YamlFile } from "../yaml/types.js";

export interface ChangeDescriptionFrontMatter {
  readonly changeKind: string;
  readonly packages: string[];
  readonly source?: YamlFile;
}

export interface ChangeDescription {
  readonly id: string;
  readonly changeKind: ChangeKindResolvedConfig;
  readonly packages: string[];
  readonly content: string;
}
