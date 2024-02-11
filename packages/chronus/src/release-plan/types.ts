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
  readonly changes: ChangeDescription[];
  readonly actions: ReleaseAction[];
}
