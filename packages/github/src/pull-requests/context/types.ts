export interface PullRequestContext {
  readonly repo: {
    readonly name: string;
    readonly owner: string;
  };
  readonly prNumber: number;
  readonly headRef: string;
  prTitle?: string;
}

export type { CIContext } from "@chronus/chronus/utils";
