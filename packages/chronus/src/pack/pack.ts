import { mkdir } from "fs/promises";
import { execAsync } from "../utils/exec-async.js";
import { resolvePath } from "../utils/path-utils.js";
import type { Package, WorkspaceType } from "../workspace-manager/types.js";
import type { ChronusWorkspace } from "../workspace/types.js";

export interface PackPackageResult {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** Name of the .tgz file created */
  readonly filename: string;
  /** Absolute path of the .tgz file created. */
  readonly path: string;
  readonly size: number;
  readonly unpackedSize: number;
}

export async function packPackage(
  workspace: ChronusWorkspace,
  pkg: Package,
  destination?: string,
): Promise<PackPackageResult> {
  const pkgDir = resolvePath(workspace.path, pkg.relativePath);
  const packDestination = destination ?? pkgDir;
  await mkdir(packDestination, { recursive: true }); // Not using the ChronusHost here because it doesn't matter as we need to call npm after.
  const command = getPackCommand(workspace.workspace.type, packDestination);
  const result = await execAsync(command.command, command.args, { cwd: pkgDir });
  if (result.code !== 0) {
    throw new Error(`Failed to pack package ${pkg.name} at ${pkg.relativePath}. Log:\n${result.stdall}`);
  }

  const parsedResult = JSON.parse(result.stdout.toString())[0];
  return {
    id: parsedResult.id,
    name: parsedResult.name,
    version: parsedResult.version,
    filename: parsedResult.filename,
    path: resolvePath(packDestination, parsedResult.filename),
    size: parsedResult.size,
    unpackedSize: parsedResult.unpackedSize,
  };
}

function getPackCommand(type: WorkspaceType, destination: string): Command {
  switch (type) {
    // case "pnpm":
    //   return getPnpmCommand(destination);
    case "npm":
    default:
      return getNpmCommand(destination);
  }
}

interface Command {
  readonly command: string;
  readonly args: string[];
}

function getPnpmCommand(destination: string): Command {
  return { command: "pnpm", args: ["pack", "--json", "--pack-destination", destination] };
}
function getNpmCommand(destination: string): Command {
  return { command: "npm", args: ["pack", "--json", "--pack-destination", destination] };
}
