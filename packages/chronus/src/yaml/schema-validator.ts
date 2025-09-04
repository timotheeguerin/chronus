import { ZodError, type ZodType, type core } from "zod";
import { ChronusDiagnosticError, type Diagnostic } from "../utils/errors.js";
import { getLocationInYamlScript } from "./location.js";
import type { YamlFile } from "./types.js";

export function validateYamlFile<T>(yamlFile: YamlFile, schema: ZodType<T>): T {
  try {
    return schema.parse(yamlFile.data);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new ChronusDiagnosticError(e.issues.map((issue) => convertZodIssueToDiagnostic(issue, yamlFile)));
    }
    throw e;
  }
}
function convertZodIssueToDiagnostic(issue: core.$ZodIssue, file: YamlFile): Diagnostic {
  return {
    code: `schema-${issue.code.toLowerCase().replace(/_/g, "-")}`,
    message: issue.message,
    severity: "error",
    target: getLocationInYamlScript(file, issue.path as any),
  };
}
