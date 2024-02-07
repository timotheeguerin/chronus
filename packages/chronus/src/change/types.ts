import type { ChangeKindResolvedConfig } from "../config/types.js";

export interface ChangeDescriptionFrontMatter {
  readonly changeKind: string;
  readonly packages: string[];
}

export interface ChangeDescription {
  readonly id: string;
  readonly changeKind: ChangeKindResolvedConfig;
  readonly packages: string[];
  readonly content: string;
}
