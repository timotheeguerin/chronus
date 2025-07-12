import { mkdir, stat } from "fs/promises";
import pacote from "pacote";
import { gte } from "semver";
import { execAsync } from "../utils/exec-async.js";
import { getLastJsonObject } from "../utils/misc-utils.js";
import { resolvePath } from "../utils/path-utils.js";
import type { Package } from "../workspace-manager/node/types.js";
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

  switch (workspace.workspace.type) {
    // calling pnpm seperately because it will replace `workspace:` protocol with the actual version in the tarball
    case "pnpm":
      return packPackageWithPnpm(pkg, pkgDir, packDestination);
    case "npm":
    default:
      return packPackageWithNpm(pkg, pkgDir, packDestination);
  }
}

async function packPackageWithNpm(pkg: Package, pkgDir: string, packDestination: string): Promise<PackPackageResult> {
  const command = getNpmCommand(packDestination);
  const result = await execAsync(command.command, command.args, { cwd: pkgDir });
  if (result.code !== 0) {
    throw new Error(`Failed to pack package ${pkg.name} at ${pkg.relativePath}. Log:\n${result.stdall}`);
  }

  const parsedResult = getLastJsonObject(result.stdout.toString());

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

function getOutputFilename(output: string, supportsJson: boolean): string {
  if (supportsJson) {
    const parsedResult = getLastJsonObject(output);
    return parsedResult.filename;
  }
  return output.trim();
}

async function packPackageWithPnpm(pkg: Package, pkgDir: string, packDestination: string): Promise<PackPackageResult> {
  const version = await getPnpmVersion(pkgDir);
  const supportsJson = gte(version, "9.14.0");
  const command = getPnpmCommand(packDestination);

  if (supportsJson) {
    command.args.push("--json");
  }
  const result = await execAsync(command.command, command.args, { cwd: pkgDir });

  if (result.code !== 0) {
    throw new Error(`Failed to pack package ${pkg.name} at ${pkg.relativePath}. Log:\n${result.stdall}`);
  }

  const filename = getOutputFilename(result.stdout.toString(), supportsJson);
  const path = resolvePath(packDestination, filename);

  const stats = await stat(path);
  const tabballManifest = await pacote.manifest(path, { fullMetadata: true });

  return {
    id: tabballManifest._id,
    name: tabballManifest.name,
    version: tabballManifest.version,
    filename: filename,
    path,
    size: stats.size,
    unpackedSize: 0,
  };
}

interface Command {
  readonly command: string;
  readonly args: string[];
}

async function getPnpmVersion(dir: string): Promise<string> {
  const result = await execAsync("pnpm", ["--version"], { cwd: dir });
  return result.stdout.toString().trim();
}

function getPnpmCommand(destination: string): Command {
  return { command: "pnpm", args: ["pack", "--pack-destination", destination] };
}
function getNpmCommand(destination: string): Command {
  return { command: "npm", args: ["pack", "--json", "--pack-destination", destination] };
}
