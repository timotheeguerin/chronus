export interface Context {
  readonly repo: {
    readonly name: string;
    readonly owner: string;
  };
  readonly prNumber: number;
  readonly headRef: string;
  prTitle?: string;
}

export interface CIContext {
  repo?: string;
  prNumber?: number;
  headRef?: string;
  prTitle?: string;
}
