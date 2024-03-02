import type { ChronusHost } from "../utils/host.js";
import { resolvePath } from "../utils/path-utils.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { changesRelativeDir } from "./common.js";
import { parseChangeDescription } from "./parse.js";
import type { ChangeDescription } from "./types.js";

export interface PrintChangeDescriptionOptions {
  readonly frontMatterComment?: string;
}

export async function readChangeDescription(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  filename: string,
): Promise<ChangeDescription> {
  const file = await host.readFile(resolvePath(workspace.path, filename));
  return parseChangeDescription(workspace.config, file);
}

/** Read all change descriptions */
export async function readChangeDescriptions(
  host: ChronusHost,
  workspace: ChronusWorkspace,
): Promise<ChangeDescription[]> {
  const changelogs = await host.glob(resolvePath(changesRelativeDir, "*.md"), { baseDir: workspace.path });
  const changesets = await Promise.all(changelogs.map((x) => readChangeDescription(host, workspace, x)));
  return changesets;
}
