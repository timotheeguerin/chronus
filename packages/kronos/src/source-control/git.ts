import { execAsync, ExecResult } from "../utils/exec-async.js";

export interface GitSourceControl {
  add(path: string, cwd: string): Promise<boolean>;
  commit(message: string, cwd: string): Promise<boolean>;
}

export class GitError extends Error {
  args: string[];

  constructor(args: string[], stderr: string) {
    super(`GitError running: git ${args.join(" ")}\n${stderr}`);
    this.args = args;
  }
}

async function execGit(args: string[], { cwd }: { cwd: string }): Promise<ExecResult> {
  const result = await execAsync("git", args, { cwd });

  if (result.code !== 0) {
    throw new GitError(args, result.stderr.toString());
  }
  return result;
}

export function createGitSourceControl(): GitSourceControl {
  return {
    add,
    commit,
  };

  async function add(path: string, cwd: string) {
    const gitCmd = await execGit(["add", path], { cwd });
    return gitCmd.code === 0;
  }

  async function commit(message: string, cwd: string) {
    const gitCmd = await execGit(["commit", "-m", message, "--allow-empty"], { cwd });
    return gitCmd.code === 0;
  }
}
