import type { ChangeKindUserConfig } from "../config/types.js";

export interface ChangeDescriptionFrontMatter {
  readonly changeKind: string;
  readonly packages: string[];
}

export interface ChangeDescription {
  readonly changeKind: ChangeKindUserConfig;
  readonly packages: string[];
  readonly content: string;
}
