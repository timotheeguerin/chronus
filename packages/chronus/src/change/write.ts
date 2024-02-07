import { dump } from "js-yaml";
import type { ChronusHost } from "../utils/host.js";
import { getDirectoryPath } from "../utils/path-utils.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { resolveChangePath } from "./common.js";
import type { ChangeDescription, ChangeDescriptionFrontMatter } from "./types.js";

export function printChangeDescription(change: Omit<ChangeDescription, "id">) {
  const frontMatter: ChangeDescriptionFrontMatter = {
    changeKind: change.changeKind.name,
    packages: change.packages,
  };
  return ["---", dump(frontMatter, { quotingType: '"' }), "---", change.content].join("\n");
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
