import type { VersionPolicy } from "../config/types.js";
import type { VersionType } from "../types.js";

export interface InternalReleaseAction {
  packageName: string;
  type: VersionType;
  oldVersion: string;
  policy: VersionPolicy;
}
