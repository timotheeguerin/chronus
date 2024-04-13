import type { File } from "../file/types.js";

export class ChronusError extends Error {}

export type DiagnosticSeverity = "error" | "warning";

export interface DiagnosticTarget {
  readonly file: File;
  readonly pos: number;
  readonly end: number;
}

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly target: DiagnosticTarget;
}

export class ChronusDiagnosticError extends Error {
  constructor(public readonly diagnostics: string[]) {
    super();
  }
}
