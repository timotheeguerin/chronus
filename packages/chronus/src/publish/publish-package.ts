import { stat } from "fs/promises";
import pacote from "pacote";
import { isCI } from "std-env";
import { execAsync, type ExecResult } from "../utils/exec-async.js";
import { NodeChronusHost, getDirectoryPath, getLastJsonObject, lookup } from "../utils/index.js";
import { createPnpmWorkspaceManager } from "../workspace-manager/node/pnpm.js";
import type { PackageBase } from "../workspace-manager/types.js";
import type { PublishPackageResult } from "./types.js";

export interface PublishPackageOptions {
  readonly otp?: string;
  readonly access?: string;
  readonly registry?: string;
  readonly engine?: "npm" | "pnpm";
  readonly tag?: string;
}

/** Npm publish json output. */
interface NpmPublishResult {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly size: number;
  readonly unpackedSize: number;
  readonly shasum: string;
  readonly integrity: string;
}

async function isDir(path: string) {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch (e) {
    // lstatSync throws an error if path doesn't exist
    return false;
  }
}

export async function publishPackage(
  pkg: PackageBase,
  pkgDir: string,
  options: PublishPackageOptions = {},
): Promise<PublishPackageResult> {
  if (await shouldUsePnpm(pkgDir, options.engine)) {
    return publishPackageWithPnpm(pkg, pkgDir, options);
  } else {
    return publishPackageWithNpm(pkg, pkgDir, options);
  }
}

async function shouldUsePnpm(pkgDir: string, engine: "npm" | "pnpm" | undefined): Promise<boolean> {
  if (engine === "pnpm") {
    return true;
  } else if (engine === "npm") {
    return false;
  }
  const pnpmWs = createPnpmWorkspaceManager();
  const root = await lookup(pkgDir, (current) => {
    return pnpmWs.is(NodeChronusHost, current);
  });
  return Boolean(root);
}

export async function publishPackageWithNpm(
  pkg: PackageBase,
  pkgDir: string,
  options: PublishPackageOptions = {},
): Promise<PublishPackageResult> {
  const command = getNpmCommand(pkgDir, options);
  const cwd = (await isDir(pkgDir)) ? pkgDir : getDirectoryPath(pkgDir);
  const result = await execAsync(command.command, command.args, {
    cwd,
  });
  if (result.code !== 0) {
    return processError(pkg, result);
  }
  const parsedResult: NpmPublishResult = getLastJsonObject(result.stdout.toString());
  return {
    published: true,
    name: parsedResult.name,
    version: parsedResult.version,
    size: parsedResult.size,
    unpackedSize: parsedResult.unpackedSize,
  };
}

export async function publishPackageWithPnpm(
  pkg: PackageBase,
  pkgDir: string,
  options: PublishPackageOptions = {},
): Promise<PublishPackageResult> {
  const command = getPnpmCommand(pkgDir, options);
  const cwd = (await isDir(pkgDir)) ? pkgDir : getDirectoryPath(pkgDir);
  const result = await execAsync(command.command, command.args, {
    cwd,
    env: { ...process.env, ...(options.registry ? { npm_config_registry: options.registry } : {}) },
  });
  if (result.code !== 0) {
    return processError(pkg, result);
  }
  const stdoutstring = result.stdout.toString();

  const json = getLastJsonObject(stdoutstring);
  if (json === null) {
    const id = stdoutstring.trim().replace("+ ", "");
    const tabballManifest = await pacote.manifest(id, { fullMetadata: true, registry: options.registry });

    return {
      published: true,
      name: tabballManifest.name,
      version: tabballManifest.version,
      size: 0,
      unpackedSize: tabballManifest.dist?.unpackedSize ?? 0,
    };
  } else {
    const parsedResult: NpmPublishResult = json;
    return {
      published: true,
      name: parsedResult.name,
      version: parsedResult.version,
      size: parsedResult.size,
      unpackedSize: parsedResult.unpackedSize,
    };
  }
}

function processError(pkg: PackageBase, result: ExecResult): PublishPackageResult {
  const json = getLastJsonObject(result.stderr.toString()) ?? getLastJsonObject(result.stdout.toString());

  if (json?.error) {
    // The first case is no 2fa provided, the second is when the 2fa is wrong (timeout or wrong words)
    if (
      (json.error.code === "EOTP" || (json.error.code === "E401" && json.error.detail.includes("--otp=<code>"))) &&
      !isCI
    ) {
      // eslint-disable-next-line no-console
      console.error(
        `\nAn error occurred while publishing ${pkg.name}: ${json.error.code}`,
        json.error.summary,
        json.error.detail ? "\n" + json.error.detail : "",
      );
    }
  }
  // eslint-disable-next-line no-console
  console.error(result.stdall.toString());

  return {
    published: false,
    name: pkg.name,
    version: pkg.version,
  };
}

interface Command {
  readonly command: string;
  readonly args: string[];
}

function getNpmCommand(fileOrDir: string, options: PublishPackageOptions): Command {
  const args = ["publish", fileOrDir, "--json"];
  if (options.access) {
    args.push("--access", options.access);
  }
  if (options.otp) {
    args.push("--otp", options.otp);
  }
  if (options.tag) {
    args.push("--tag", options.tag);
  }
  if (options.registry) {
    args.push("--registry", options.registry);
  }
  return { command: "npm", args };
}

function getPnpmCommand(fileOrDir: string, options: PublishPackageOptions): Command {
  const args = ["publish", fileOrDir, "--json", "--no-git-checks"];
  if (options.access) {
    args.push("--access", options.access);
  }
  if (options.otp) {
    args.push("--otp", options.otp);
  }
  if (options.tag) {
    args.push("--tag", options.tag);
  }
  if (options.registry) {
    args.push("--registry", options.registry);
  }
  return { command: "pnpm", args };
}
