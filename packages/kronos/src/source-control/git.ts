import { execAsync, ExecResult } from "../utils/exec-async.js";

export interface GitSourceControl {
  /**
   * Stage the given path(file or directory).
   * @path path to stage
   * @param repoDir Repository directory
   */
  add(path: string, repoDir: string): Promise<boolean>;

  /**
   * Commit the current staged changes
   * @param message Commit message.
   * @param dir Repository directory
   */
  commit(message: string, dir: string): Promise<boolean>;

  /**
   * List untracked files. (Only files that are not tracked at all by git yet, doesn't include files with unstaged changes.)
   * ```bash
   * git ls-files --others --exclude-standard
   * ```
   */
  listUntrackedFiles(dir: string): Promise<string[]>;

  /**
   * List tracked files that are modfied since last commit.(Does not include staged files.)
   * ```bash
   * git ls-files --modified --exclude-standard
   * ```
   */
  listModifiedFiles(dir: string): Promise<string[]>;

  /**
   * List untracked files and modifed files
   * ```bash
   * git ls-files --modified --others --exclude-standard
   * ```
   */
  listUntrackedOrModifiedFiles(dir: string): Promise<string[]>;
  /**
   * List files currently staged.
   * ```bash
   * git diff --name-only --cached
   * ```
   */
  listStagedFiles(dir: string): Promise<string[]>;
}

export class GitError extends Error {
  args: string[];

  constructor(args: string[], stderr: string) {
    super(`GitError running: git ${args.join(" ")}\n${stderr}`);
    this.args = args;
  }
}

async function execGit(args: string[], { dir }: { dir: string }): Promise<ExecResult> {
  const result = await execAsync("git", args, { cwd: dir });

  if (result.code !== 0) {
    throw new GitError(args, result.stderr.toString());
  }
  return result;
}

export function createGitSourceControl(): GitSourceControl {
  return {
    add,
    commit,
    listUntrackedFiles,
    listModifiedFiles,
    listUntrackedOrModifiedFiles,
    listStagedFiles,
  };

  async function add(path: string, dir: string) {
    const gitCmd = await execGit(["add", path], { dir });
    return gitCmd.code === 0;
  }

  async function commit(message: string, dir: string) {
    const gitCmd = await execGit(["commit", "-m", message, "--allow-empty"], { dir });
    return gitCmd.code === 0;
  }

  async function listUntrackedFiles(dir: string): Promise<string[]> {
    return splitStdoutLines(await execGit(["ls-files", "--others", "--exclude-standard"], { dir }));
  }
  async function listModifiedFiles(dir: string) {
    return splitStdoutLines(await execGit(["ls-files", "--modified", "--exclude-standard"], { dir }));
  }

  async function listUntrackedOrModifiedFiles(dir: string) {
    return splitStdoutLines(await execGit(["ls-files", "--modified", "--others", "--exclude-standard"], { dir }));
  }

  async function listStagedFiles(dir: string) {
    return splitStdoutLines(await execGit(["diff", "--name-only", "--cached"], { dir }));
  }
}

function splitStdoutLines(result: ExecResult): string[] {
  return result.stdout
    .toString()
    .split("\n")
    .filter((a) => a);
}
