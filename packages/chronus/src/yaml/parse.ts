import { YAMLError, parseDocument } from "yaml";
import { createFile } from "../file/create-file.js";
import type { File } from "../file/index.js";
import { ChronusError, type Diagnostic, type DiagnosticSeverity } from "../utils/errors.js";

export function parseYaml(source: string | File): unknown {
  const diagnostics = [];

  const file = typeof source === "string" ? createFile(source, "<anonymous file>") : source;

  const doc = parseDocument(file.content, {
    prettyErrors: false, // We are handling the error display ourself to be consistent in the style.
  });
  for (const error of doc.errors) {
    diagnostics.push(convertYamlErrorToDiagnostic("error", error, file));
  }
  for (const warning of doc.warnings) {
    diagnostics.push(convertYamlErrorToDiagnostic("warning", warning, file));
  }
  if (diagnostics.length > 0) {
    throw new ChronusError();
  }
  return doc.toJSON();
}

function convertYamlErrorToDiagnostic(severity: DiagnosticSeverity, error: YAMLError, file: File): Diagnostic {
  return {
    code: `yaml-${error.code.toLowerCase().replace(/_/g, "-")}`,
    message: error.message,
    severity,
    target: { file, pos: error.pos[0], end: error.pos[1] },
  };
}
