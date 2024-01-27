import type { VersionType } from "@changesets/types";

export interface ReleaseAction {
  readonly packageName: string;
  readonly type: VersionType;
  readonly oldVersion: string;
  readonly newVersion: string;
}

export interface ReleasePlan {
  readonly actions: ReleaseAction[];
}
