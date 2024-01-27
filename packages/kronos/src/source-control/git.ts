import { execAsync, type ExecResult } from "../utils/exec-async.js";

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
   * List tracked files that are modfied since last commit.(Does not include staged files.)
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
   * @param ref Git ref
   * @param dir Repository directory
   */
  listChangedFilesSince(ref: string): Promise<string[]>;
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
    listChangedFilesSince,
  };

  async function getRepoRoot(): Promise<string> {
    if (repoRoot === undefined) {
      const { stdout } = await execGit(["rev-parse", "--show-toplevel"], { repositoryPath });
      repoRoot = stdout.toString().trim().replace(/\n|\r/g, "");
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

  async function listChangedFilesSince(ref: string) {
    return splitStdoutLines(await execGit(["diff", "--name-only", `${ref}...`], { repositoryPath }));
  }
}

function splitStdoutLines(result: ExecResult): string[] {
  return result.stdout
    .toString()
    .split("\n")
    .filter((a) => a);
}
