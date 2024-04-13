import pc from "picocolors";
import type { Formatter } from "picocolors/types.js";
import { DynamicReporter } from "../reporters/dynamic.js";
import type { Reporter } from "../reporters/types.js";
import {
  ChronusDiagnosticError,
  type Diagnostic,
  type DiagnosticSeverity,
  type DiagnosticTarget,
} from "../utils/errors.js";

function withReporter<T>(fn: (reporter: T & { reporter: Reporter }) => Promise<void>): (args: T) => Promise<void> {
  return (args: T) => {
    const reporter = new DynamicReporter();
    return fn({ reporter, ...args });
  };
}

export function withErrors<T>(fn: (args: T) => Promise<void>): (args: T) => Promise<void> {
  return async (args: T) => {
    try {
      await fn(args);
    } catch (error) {
      logError({ pretty: true }, error);
      process.exit(1);
    }
  };
}

export function withErrorsAndReporter<T>(
  fn: (reporter: T & { reporter: Reporter }) => Promise<void>,
): (args: T) => Promise<void> {
  return withErrors(withReporter(fn));
}

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(message);
}

function logError(options: FormatLogOptions, error: unknown) {
  /* eslint-disable no-console */
  if (error instanceof ChronusDiagnosticError) {
    printDiagnostics(options, error.diagnostics);
    log("");
    log(`Found ${error.diagnostics.length} errors.`);
    process.exit(1);
  } else {
    console.error(error);
  }
  /* eslint-enable no-console */
}

function printDiagnostics(options: FormatLogOptions, diagnostics: readonly Diagnostic[]) {
  for (const diagnostic of diagnostics) {
    log(formatDiagnostic(options, diagnostic));
  }
}
export interface FormatLogOptions {
  readonly pretty?: boolean;
}

function formatDiagnostic(options: FormatLogOptions, diagnostic: Diagnostic) {
  const code = color(options, diagnostic.code ? ` ${diagnostic.code}` : "", pc.gray);
  const level = formatSeverity(options, diagnostic.severity);
  const content = `${level}${code}: ${diagnostic.message}`;
  const location = diagnostic.target;
  if (location?.file) {
    const formattedLocation = formatSourceLocation(options, location);
    return `${formattedLocation} - ${content}`;
  } else {
    return content;
  }
}

function color(options: FormatLogOptions, text: string, color: Formatter) {
  return options.pretty ? color(text) : text;
}

function formatSeverity(options: FormatLogOptions, severity: DiagnosticSeverity) {
  switch (severity) {
    case "error":
      return color(options, "error", pc.red);
    case "warning":
      return color(options, "warning", pc.yellow);
  }
}

function formatSourceLocation(options: FormatLogOptions, location: DiagnosticTarget) {
  const postition = getLineAndColumn(location);
  const path = color(options, location.file.path, pc.cyan);

  const line = color(options, postition.start.line.toString(), pc.yellow);
  const column = color(options, postition.start.column.toString(), pc.yellow);
  return `${path}:${line}:${column}`;
}

interface RealLocation {
  start: { line: number; column: number };
  end?: { line: number; column: number };
}

function getLineAndColumn(location: DiagnosticTarget): RealLocation {
  const pos = location.file.getLineAndCharacterOfPosition(location.pos ?? 0);
  const end = location.end ? location.file.getLineAndCharacterOfPosition(location.end) : undefined;
  const result: RealLocation = {
    start: { line: pos.line + 1, column: pos.character + 1 },
  };
  if (end) {
    result.end = { line: end.line + 1, column: end.character + 1 };
  }
  return result;
}
