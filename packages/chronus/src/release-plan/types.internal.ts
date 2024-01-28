import type { VersionType } from "@changesets/types";
import type { VersionPolicy } from "../config/types.js";

export interface InternalReleaseAction {
  packageName: string;
  type: VersionType;
  oldVersion: string;
  policy: VersionPolicy;
}
