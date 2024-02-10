import { dump } from "js-yaml";
import type { ChronusHost } from "../utils/host.js";
import { isDefined } from "../utils/misc-utils.js";
import { getDirectoryPath } from "../utils/path-utils.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { resolveChangePath } from "./common.js";
import type { ChangeDescription, ChangeDescriptionFrontMatter } from "./types.js";

export interface PrintChangeDescriptionOptions {
  readonly frontMatterComment?: string;
}

export function printChangeDescription(change: Omit<ChangeDescription, "id">, options?: PrintChangeDescriptionOptions) {
  const frontMatter: ChangeDescriptionFrontMatter = {
    changeKind: change.changeKind.name,
    packages: change.packages,
  };
  const frontMatterComment = options?.frontMatterComment && `# ${options?.frontMatterComment}`;
  return ["---", frontMatterComment, dump(frontMatter, { quotingType: '"' }).trimEnd(), "---", "", change.content]
    .filter(isDefined)
    .join("\n");
}

export async function writeChangeDescription(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  change: ChangeDescription,
): Promise<string> {
  const content = printChangeDescription(change);
  const filename = resolveChangePath(workspace, change.id);
  await host.mkdir(getDirectoryPath(filename), { recursive: true });
  await host.writeFile(filename, content);

  return filename;
}

export async function deleteChangeDescription(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  change: ChangeDescription,
): Promise<void> {
  const filename = resolveChangePath(workspace, change.id);
  await host.rm(filename);
}
