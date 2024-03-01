import { isCI } from "std-env";
import { execAsync } from "../utils/exec-async.js";
import { getLastJsonObject } from "../utils/index.js";
import type { PackageBase } from "../workspace-manager/types.js";

export interface PublishPackageOptions {
  readonly otp?: string;
  readonly access?: string;
  readonly registry?: string;
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
  pkg: PackageBase,
  pkgDir: string,
  options: PublishPackageOptions = {},
): Promise<PublishPackageResult> {
  const command = getNpmCommand(pkgDir, options);
  const result = await execAsync(command.command, command.args);
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

  const parsedResult: NpmPublishResult = getLastJsonObject(result.stdout.toString());
  // eslint-disable-next-line no-console
  return {
    published: true,
    name: parsedResult.name,
    version: parsedResult.version,
    filename: parsedResult.filename,
    size: parsedResult.size,
    unpackedSize: parsedResult.unpackedSize,
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
  if (options.registry) {
    args.push("--registry", options.registry);
  }
  return { command: "npm", args };
}
