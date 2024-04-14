export interface TextFile {
  readonly path: string;
  readonly content: string;
  getLineStarts(): readonly number[];
  getLineAndCharacterOfPosition(position: number): { readonly line: number; readonly character: number };
}

/**
 * Represent a file that is contained within another file.
 * e.g. a markdown code block
 */
export interface EmbeddedFile {
  readonly file: TextFile;
  readonly pos: number;
  readonly end: number;
  readonly content: string;
}
