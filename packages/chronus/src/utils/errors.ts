import type { EmbeddedFile, TextFile } from "../file/types.js";

export class ChronusError extends Error {}

export type DiagnosticSeverity = "error" | "warning";

export interface FileLocation {
  readonly file: TextFile | EmbeddedFile;
  readonly pos: number;
  readonly end: number;
}

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly target: FileLocation;
}

export class ChronusDiagnosticError extends Error {
  constructor(public readonly diagnostics: readonly Diagnostic[]) {
    super();
  }
}
