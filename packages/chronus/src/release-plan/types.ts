import type { NewChangeset, VersionType } from "@changesets/types";

export interface ReleaseAction {
  readonly packageName: string;
  readonly type: VersionType;
  readonly oldVersion: string;
  readonly newVersion: string;
  readonly changesets: NewChangeset[];
}

export interface ReleasePlan {
  readonly changesets: NewChangeset[];
  readonly actions: ReleaseAction[];
}
