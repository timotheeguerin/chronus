import type { ChangeDescription } from "../change/types.js";
import type { ChronusWorkspace } from "../index.js";

export interface ChangelogGenerator {
  readonly loadData?: (changes: ChangeDescription[], interactive?: boolean) => Promise<void>;
  readonly renderPackageVersion: (newVersion: string, changes: ChangeDescription[]) => string;
}

export type ChangelogGeneratorFactory<T> = (workspace: ChronusWorkspace, options: T) => ChangelogGenerator;
