import { isCI } from "std-env";
import { execAsync } from "../utils/exec-async.js";
import { getLastJsonObject } from "../utils/index.js";
import { resolvePath } from "../utils/path-utils.js";
import type { Package, WorkspaceType } from "../workspace-manager/types.js";
import type { ChronusWorkspace } from "../workspace/index.js";

export interface PublishPackageOptions {
  readonly otp?: string;
  readonly access?: string;
}

export type PublishPackageResult = PublishedPackageSuccess | PublishedPackageFailure;

export interface PublishedPackageSuccess {
  readonly published: true;
  readonly name: string;
  readonly version: string;
  readonly filename: string;
  readonly size: number;
  readonly unpackedSize: number;
}

export interface PublishedPackageFailure {
  readonly published: false;
}

/** Npm publish json output. */
interface NpmPublishResult {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly filename: string;
  readonly size: number;
  readonly unpackedSize: number;
  readonly shasum: string;
  readonly integrity: string;
}

export async function publishPackage(
  workspace: ChronusWorkspace,
  pkg: Package,
  options: PublishPackageOptions = {},
): Promise<PublishPackageResult> {
  const pkgDir = resolvePath(workspace.path, pkg.relativePath);
  const command = getPublishCommand(workspace.workspace.type, options);
  const result = await execAsync(command.command, command.args, { cwd: pkgDir });
  if (result.code !== 0) {
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
    };
  }

  const json: Record<string, NpmPublishResult> = getLastJsonObject(result.stdout.toString());
  const parsedResult = json[pkg.name];
  return {
    published: true,
    name: parsedResult.name,
    version: parsedResult.version,
    filename: parsedResult.filename,
    size: parsedResult.size,
    unpackedSize: parsedResult.unpackedSize,
  };
}

function getPublishCommand(type: WorkspaceType, options: PublishPackageOptions): Command {
  switch (type) {
    // case "pnpm":
    //   return getPnpmCommand();
    case "npm":
    default:
      return getNpmCommand(options);
  }
}

interface Command {
  readonly command: string;
  readonly args: string[];
}

// function getPnpmCommand(destination: string): Command {
//   return { command: "pnpm", args: ["publish", "--json", "--no-git-checks"] };
// }
function getNpmCommand(options: PublishPackageOptions): Command {
  const args = ["publish", "--json", "--pack-destination"];
  if (options.access) {
    args.push("--access", options.access);
  }
  if (options.otp) {
    args.push("--otp", options.otp);
  }
  return { command: "npm", args };
}
