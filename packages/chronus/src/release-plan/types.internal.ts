import type { VersionType } from "@changesets/types";

export interface InternalRelease {
  packageName: string;
  type: VersionType;
  oldVersion: string;
}
