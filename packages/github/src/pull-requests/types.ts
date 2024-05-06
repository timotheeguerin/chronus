export interface ChangeStatusComment {
  readonly repo: {
    readonly owner: string;
    readonly name: string;
  };
  readonly prNumber: number;
  readonly content: string;
}
