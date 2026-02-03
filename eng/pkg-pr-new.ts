import { execSync } from "child_process";
import { execa, type Result } from "execa";
import { readdir } from "fs/promises";
import { repoRoot } from "./common.ts";

const files = await listChangedFilesSince(`origin/main`, { repositoryPath: repoRoot });

// eslint-disable-next-line no-console
console.log("modified files:", files);

const packages = await readdir(repoRoot + "/packages", { withFileTypes: true });
const paths = packages
  .filter((dirent) => dirent.isDirectory() && dirent.name !== "http-client-python")
  .map((dirent) => `packages/${dirent.name}`);

const modifiedPaths = paths.filter((x) => files.some((f) => f.startsWith(x)));
// eslint-disable-next-line no-console
console.log("Packages", { all: paths, modified: modifiedPaths });
try {
  execSync(`pnpx pkg-pr-new publish ${modifiedPaths.map((x) => `'${x}'`).join(" ")} --pnpm`, {
    stdio: "inherit",
    encoding: "utf-8",
    cwd: repoRoot,
  });
} catch (e: any) {
  // eslint-disable-next-line no-console
  console.error("Failed to run pkg-pr-new publish");
}

export async function listChangedFilesSince(ref: string, { repositoryPath }: { repositoryPath: string }) {
  return splitStdoutLines(await execGit(["diff", "--name-only", `${ref}...`], { repositoryPath }));
}

async function execGit(args: string[], { repositoryPath }: { repositoryPath: string }): Promise<Result> {
  const result = await execa("git", args, { cwd: repositoryPath });

  if (result.exitCode !== 0) {
    throw new GitError(args, result.stderr.toString());
  }
  return result;
}

export class GitError extends Error {
  args: string[];

  constructor(args: string[], stderr: string) {
    super(`GitError running: git ${args.join(" ")}\n${stderr}`);
    this.args = args;
  }
}

function splitStdoutLines(result: Result): string[] {
  return result
    .stdout!.toString()
    .split("\n")
    .filter((a) => a);
}
