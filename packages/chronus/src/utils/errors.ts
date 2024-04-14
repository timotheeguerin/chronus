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
  readonly target: FileLocation | null;
}

export class ChronusDiagnosticError extends Error {
  public readonly diagnostics: readonly Diagnostic[];
  constructor(diagnostics: Diagnostic | readonly Diagnostic[]) {
    super();
    if (Array.isArray(diagnostics)) {
      this.diagnostics = diagnostics;
    } else {
      this.diagnostics = [diagnostics as any];
    }
  }
}

export function throwIfDiagnostic(diagnostics: readonly Diagnostic[]): void {
  if (diagnostics.length > 0) {
    throw new ChronusDiagnosticError(diagnostics);
  }
}

export class ChronusUserError extends ChronusError {}
