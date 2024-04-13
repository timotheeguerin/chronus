export interface File {
  readonly path: string;
  readonly content: string;
  getLineStarts(): readonly number[];
  getLineAndCharacterOfPosition(position: number): { readonly line: number; readonly character: number };
}
