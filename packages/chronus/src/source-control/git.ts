import { existsSync } from "fs";
import { execAsync, type ExecResult } from "../utils/exec-async.js";
import { resolvePath } from "../utils/path-utils.js";

export interface GitRepository {
  /**
   * Get the repository root.
   * @path path to stage
   */
  getRepoRoot(): Promise<string>;

  /**
   * Stage the given path(file or directory).
   * @path path to stage
   */
  add(path: string): Promise<boolean>;

  /**
   * Commit the current staged changes
   * @param message Commit message.
   */
  commit(message: string): Promise<boolean>;

  /**
   * Return the current commit id.
   * @param dir Repository directory
   */
  getCurrentCommitId(): Promise<string>;

  /**
   * List untracked files. (Only files that are not tracked at all by git yet, doesn't include files with unstaged changes.)
   * ```bash
   * git ls-files --others --exclude-standard
   * ```
   */
  listUntrackedFiles(): Promise<string[]>;

  /**
   * List tracked files that are modified since last commit.(Does not include staged files.)
   * ```bash
   * git ls-files --modified --exclude-standard
   * ```
   */
  listModifiedFiles(): Promise<string[]>;

  /**
   * List untracked files and modifed files
   * ```bash
   * git ls-files --modified --others --exclude-standard
   * ```
   */
  listUntrackedOrModifiedFiles(): Promise<string[]>;
  /**
   * List files currently staged.
   * ```bash
   * git diff --name-only --cached
   * ```
   */
  listStagedFiles(): Promise<string[]>;

  /**
   * Get the merge base from HEAD and the given ref.
   * @param ref Target ref.
   */
  getMergeBase(ref: string): Promise<string>;

  /**
   * Returns files changed since the given ref. Does not include any uncomitted file change.
   * @param dir Repository directory
   */
  listChangedFilesSince(ref: string): Promise<string[]>;

  /**
   * Returns files changed from the base remote branch.
   * @param dir Repository directory
   */
  listChangedFilesFromBase(baseBranch: string): Promise<string[]>;

  /**
   * Get the name of the current local branch.
   */
  getCurrentBranch(): Promise<string>;

  /**
   * Return the commit ids that added the given files.
   */
  getCommitsThatAddFiles(files: string[]): Promise<Record<string, string>>;
}

export class GitError extends Error {
  args: string[];

  constructor(args: string[], stderr: string) {
    super(`GitError running: git ${args.join(" ")}\n${stderr}`);
    this.args = args;
  }
}

async function execGit(args: string[], { repositoryPath }: { repositoryPath: string }): Promise<ExecResult> {
  const result = await execAsync("git", args, { cwd: repositoryPath });

  if (result.code !== 0) {
    throw new GitError(args, result.stderr.toString());
  }
  return result;
}

/**
 * Create a git manipulation tool for the given repo.
 */
export function createGitSourceControl(repositoryPath: string): GitRepository {
  let repoRoot: string | undefined;
  return {
    getRepoRoot,
    add,
    commit,
    getCurrentCommitId,
    listUntrackedFiles,
    listModifiedFiles,
    listUntrackedOrModifiedFiles,
    listStagedFiles,
    getMergeBase,
    listChangedFilesFromBase,
    listChangedFilesSince,
    getCurrentBranch,
    getCommitsThatAddFiles,
  };

  async function getRepoRoot(): Promise<string> {
    if (repoRoot === undefined) {
      repoRoot = trimSingleLine(await execGit(["rev-parse", "--show-toplevel"], { repositoryPath }));
    }
    return repoRoot;
  }

  async function add(path: string) {
    const { code } = await execGit(["add", path], { repositoryPath });
    return code === 0;
  }

  async function commit(message: string) {
    const { code } = await execGit(["commit", "-m", message, "--allow-empty"], { repositoryPath });
    return code === 0;
  }

  async function getCurrentCommitId(): Promise<string> {
    const { stdout } = await execGit(["rev-parse", "--short", "HEAD"], { repositoryPath });
    return stdout.toString().trim();
  }

  async function listUntrackedFiles(): Promise<string[]> {
    return splitStdoutLines(await execGit(["ls-files", "--others", "--exclude-standard"], { repositoryPath }));
  }
  async function listModifiedFiles() {
    return splitStdoutLines(await execGit(["ls-files", "--modified", "--exclude-standard"], { repositoryPath }));
  }

  async function listUntrackedOrModifiedFiles() {
    return splitStdoutLines(
      await execGit(["ls-files", "--modified", "--others", "--exclude-standard"], { repositoryPath }),
    );
  }

  async function listStagedFiles() {
    return splitStdoutLines(await execGit(["diff", "--name-only", "--cached"], { repositoryPath }));
  }

  async function getMergeBase(ref: string) {
    const { stdout } = await execGit(["merge-base", "HEAD", ref], { repositoryPath });
    return stdout.toString().trim();
  }

  async function listChangedFilesFromBase(baseBranch: string) {
    let remoteBase: string | undefined;
    try {
      remoteBase = await findRemoteForBranch(baseBranch);
    } catch {
      // ignore
    }
    if (remoteBase === undefined) {
      remoteBase = `refs/remotes/origin/${baseBranch}`;
    }
    return await listChangedFilesSince(remoteBase);
  }

  async function listChangedFilesSince(ref: string) {
    return splitStdoutLines(await execGit(["diff", "--name-only", `${ref}...`], { repositoryPath }));
  }

  async function findRemoteForBranch(branch: string) {
    const ref = splitStdoutLines(await execGit(["rev-parse", `--symbolic-full-name`, branch], { repositoryPath }))[0];
    return splitStdoutLines(
      await execGit(["for-each-ref", "--format", "%(upstream:short)", ref], { repositoryPath }),
    )[0];
  }

  async function getCurrentBranch() {
    return trimSingleLine(await execGit(["rev-parse", "--abbrev-ref", "HEAD"], { repositoryPath }));
  }

  async function getCommitsThatAddFiles(files: string[]): Promise<Record<string, string>> {
    const commits: Record<string, string> = {};
    // Paths we haven't completed processing on yet
    let remaining = files;

    do {
      // Fetch commit information for all paths we don't have yet
      const commitInfos = await Promise.all(
        remaining.map(async (gitPath: string) => {
          const [commitSha, parentSha] = trimSingleLine(
            await execGit(["log", "--diff-filter=A", "--max-count=1", "--format=%H:%p", gitPath], { repositoryPath }),
          ).split(":");
          return { path: gitPath, commitSha, parentSha };
        }),
      );

      // To collect commits without parents (usually because they're absent from
      // a shallow clone).
      const commitsWithMissingParents = [];

      for (const info of commitInfos) {
        if (info.commitSha) {
          if (info.parentSha) {
            // We have found the parent of the commit that added the file.
            // Therefore we know that the commit is legitimate and isn't simply the boundary of a shallow clone.
            commits[info.path] = info.commitSha;
          } else {
            commitsWithMissingParents.push(info);
          }
        } else {
          // No commit for this file, which indicates it doesn't exist.
        }
      }

      if (commitsWithMissingParents.length === 0) {
        break;
      }

      // The commits we've found may be the real commits or they may be the boundary of
      // a shallow clone.

      // Can we deepen the clone?
      if (await isRepoShallow({ repositoryPath })) {
        // Yes.
        await deepenCloneBy({ by: 50, repositoryPath });

        remaining = commitsWithMissingParents.map((p) => p.path);
      } else {
        // It's not a shallow clone, so all the commit SHAs we have are legitimate.
        for (const unresolved of commitsWithMissingParents) {
          commits[unresolved.path] = unresolved.commitSha;
        }
        break;
      }
      // eslint-disable-next-line no-constant-condition
    } while (true);
    return commits;
  }

  async function deepenCloneBy({ by, repositoryPath }: { by: number; repositoryPath: string }) {
    await execGit(["fetch", `--deepen=${by}`], { repositoryPath });
  }

  async function isRepoShallow({ repositoryPath }: { repositoryPath: string }) {
    const isShallowRepoOutput = (
      await execGit(["rev-parse", "--is-shallow-repository"], {
        repositoryPath,
      })
    ).stdout
      .toString()
      .trim();

    if (isShallowRepoOutput === "--is-shallow-repository") {
      // We have an old version of Git (<2.15) which doesn't support `rev-parse --is-shallow-repository`
      // In that case, we'll test for the existence of .git/shallow.

      // Firstly, find the .git folder for the repo; note that this will be relative to the repo dir
      const gitDir = (await execGit(["rev-parse", "--git-dir"], { repositoryPath })).stdout.toString().trim();

      const fullGitDir = resolvePath(repositoryPath, gitDir);

      // Check for the existence of <gitDir>/shallow
      return existsSync(resolvePath(fullGitDir, "shallow"));
    } else {
      // We have a newer Git which supports `rev-parse --is-shallow-repository`. We'll use
      // the output of that instead of messing with .git/shallow in case that changes in the future.
      return isShallowRepoOutput === "true";
    }
  }
}

function splitStdoutLines(result: ExecResult): string[] {
  return result.stdout
    .toString()
    .split("\n")
    .filter((a) => a);
}

function trimSingleLine(result: ExecResult) {
  return result.stdout.toString().trim().replace(/\n|\r/g, "");
}
