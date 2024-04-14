import z from "zod";
import { createEmbeddedFile, type EmbeddedFile, type TextFile } from "../file/index.js";
import { ChronusDiagnosticError, type Diagnostic } from "../utils/errors.js";
import { getBaseFileName } from "../utils/path-utils.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { getLocationInYamlScript } from "../yaml/location.js";
import { parseYaml } from "../yaml/parse.js";
import { validateYamlFile } from "../yaml/schema-validator.js";
import type { ChangeDescription, ChangeDescriptionFrontMatter } from "./types.js";

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;

const changeFrontMatterSchema = z.object({
  changeKind: z.string(),
  packages: z.array(z.string()),
});

function parseChangeFrontMatter(content: EmbeddedFile | string): ChangeDescriptionFrontMatter {
  const yaml = parseYaml(content);
  return { ...validateYamlFile(yaml, changeFrontMatterSchema), source: yaml };
}

export function parseChangeDescription(workspace: ChronusWorkspace, file: TextFile): ChangeDescription {
  const execResult = mdRegex.exec(file.content);
  if (!execResult) {
    throw new ChronusDiagnosticError([
      {
        code: "missing-front-matter",
        severity: "error",
        message: `Couldn't parse ${file.path}. Front matter is missing.`,
        target: { file, pos: 0, end: 0 },
      },
    ]);
  }
  const [, frontMatterRaw, contentRaw] = execResult;
  const pos = file.content.indexOf(frontMatterRaw);
  const frontMattterFile = createEmbeddedFile({ content: frontMatterRaw, file, pos, end: pos + frontMatterRaw.length });
  const frontMatter = parseChangeFrontMatter(frontMattterFile);

  const changeKind = workspace.config.changeKinds[frontMatter.changeKind];
  const diagnostics: Diagnostic[] = [];
  if (changeKind === undefined) {
    diagnostics.push({
      code: "invalid-change-kind",
      severity: "error",
      message: `Change is using a changeKind ${frontMatter.changeKind} which is defined in the config. Available ones are:\n${Object.keys(workspace.config.changeKinds).join(", ")}`,
      target: frontMatter.source ? getLocationInYamlScript(frontMatter.source, ["changeKind"]) : null,
    });
  }

  for (const packageName of frontMatter.packages) {
    try {
      workspace.getPackage(packageName);
    } catch (e) {
      diagnostics.push({
        code: "invalid-package-name",
        severity: "error",
        message: `Change is referencing package '${packageName}' but it is not found in the workspace.`,
        target: frontMatter.source ? getLocationInYamlScript(frontMatter.source, ["packages"]) : null,
      });
    }
  }
  if (diagnostics.length > 0) {
    throw new ChronusDiagnosticError(diagnostics);
  }
  const id = getBaseFileName(file.path).replace(/.md$/, "");
  return {
    ...frontMatter,
    id,
    changeKind,
    content: contentRaw.trim(),
  };
}
