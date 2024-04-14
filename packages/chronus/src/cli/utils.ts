import pc from "picocolors";
import type { Formatter } from "picocolors/types.js";
import type { TextFile } from "../file/types.js";
import { DynamicReporter } from "../reporters/dynamic.js";
import type { Reporter } from "../reporters/types.js";
import {
  ChronusDiagnosticError,
  type Diagnostic,
  type DiagnosticSeverity,
  type FileLocation,
} from "../utils/errors.js";
import { normalizePath } from "../utils/path-utils.js";

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

function formatSourceLocation(options: FormatLogOptions, location: FileLocation) {
  const postition = getLineAndColumn(location);
  const path = color(options, getPath(location), pc.cyan);

  const line = color(options, postition.start.line.toString(), pc.yellow);
  const column = color(options, postition.start.column.toString(), pc.yellow);
  return `${path}:${line}:${column}`;
}

function getPath(location: FileLocation) {
  const path = "file" in location.file ? location.file.file.path : location.file.path;
  const cwd = normalizePath(process.cwd()) + "/";
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}

interface RealLocation {
  start: { line: number; column: number };
  end?: { line: number; column: number };
}

function getLineAndColumn(location: FileLocation): RealLocation {
  let pos = location.pos;
  let end = location.end;
  const file: TextFile = "file" in location.file ? location.file.file : location.file;
  if ("file" in location.file) {
    pos = Math.min(pos + location.file.pos, location.file.end);
    if (end !== undefined) {
      end += Math.min(end + location.file.pos, location.file.end);
    }
  }
  const startLC = file.getLineAndCharacterOfPosition(pos);
  const endLC = end ? file.getLineAndCharacterOfPosition(end) : undefined;
  const result: RealLocation = {
    start: { line: startLC.line + 1, column: startLC.character + 1 },
  };
  if (endLC) {
    result.end = { line: endLC.line + 1, column: endLC.character + 1 };
  }
  return result;
}
