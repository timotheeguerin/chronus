import type { ChangeDescription } from "../change/types.js";
import type { ChronusWorkspace } from "../index.js";

export interface ChangelogGenerator {
  readonly loadData?: (changes: ChangeDescription[], interactive?: boolean) => Promise<void>;
  /** Render the changelog for a package version. */
  readonly renderPackageVersion: (newVersion: string, changes: ChangeDescription[]) => string;
  /** Render aggregated changelog from multiple packages sharing the same version. */
  readonly renderAggregatedChangelog: (newVersion: string, changes: Record<string, ChangeDescription[]>) => string;
}

export interface ChangelogGeneratorInit<T> {
  readonly workspace: ChronusWorkspace;
  readonly options: T;
  /** All the changes(Across all packages) involved in the current operation. This is used if any data must be loaded. */
  readonly changes: ChangeDescription[];

  /** If we are running in an interactive session where we could ask for the user input. */
  readonly interactive: boolean;
}
export type ChangelogGeneratorFactory<T> = (
  init: ChangelogGeneratorInit<T>,
) => ChangelogGenerator | Promise<ChangelogGenerator>;
