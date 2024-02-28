import { execAsync } from "../utils/exec-async.js";
import { getLastJsonObject } from "../utils/index.js";
import { resolvePath } from "../utils/path-utils.js";
import type { Package, WorkspaceType } from "../workspace-manager/types.js";
import type { ChronusWorkspace } from "../workspace/index.js";

export interface PublishPackageOptions {
}

export type PublishedPackageResult = PublishedPackageSuccess | PublishedPackageFailure;

export interface PublishedPackageSuccess{
  readonly published: true;
}

export interface PublishedPackageFailure{
  readonly published: false;
}

export async function publishPackage(workspace: ChronusWorkspace, pkg: Package, options: PublishPackageOptions = {}) {
  const pkgDir = resolvePath(workspace.path, pkg.relativePath);
  const command = getPublishCommand(workspace.workspace.type);
  const result = await execAsync(command.command, command.args, { cwd: pkgDir });
  if (result.code !== 0) {
    const parsedError = getLastJsonObject(result.stderr.toString()) ?? getLastJsonObject(result.stdout.toString());
    // eslint-disable-next-line no-console
    console.log(parsedError);

    return {
      published: false,
    }
  }

  const parsedResult =  getLastJsonObject(result.stdout.toString());
  console.log("Parsed result", parsedResult);
  return {
    published: true,
  };
}


function getPublishCommand(type: WorkspaceType): Command {
  switch (type) {
    // case "pnpm":
    //   return getPnpmCommand();
    case "npm":
    default:
      return getNpmCommand();
  }
}

interface Command {
  readonly command: string;
  readonly args: string[];
}

// function getPnpmCommand(destination: string): Command {
//   return { command: "pnpm", args: ["publish", "--json", "--no-git-checks"] };
// }
function getNpmCommand(): Command {
  return { command: "npm", args: ["publish", "--json", "--pack-destination"] };
}
