import type { ChangeDescription } from "../change/types.js";
import type { VersionType } from "../types.js";

export interface ReleaseAction {
  readonly packageName: string;
  readonly type: VersionType;
  readonly oldVersion: string;
  readonly newVersion: string;
  readonly changes: ChangeDescription[];
}

export interface ReleasePlan {
  readonly changes: ReleasePlanChangeApplication[];
  readonly actions: ReleaseAction[];
}

export type ReleasePlanChangeUsage = "unused" | "used" | "partial";

export interface ReleasePlanChangeApplication {
  readonly usage: "unused" | "used" | "partial";
  /**
   * Name of the packages this change description was used to bump.
   * In the case of `used` it should match the `change.packages`
   * In the case of `partial` it should be a subset of `change.packages`
   * In the case of `unused` it should be an empty array
   */
  readonly packages: string[];
  readonly change: ChangeDescription;
}
