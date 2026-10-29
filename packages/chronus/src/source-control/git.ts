import { existsSync } from "fs";
import { relative } from "node:path";

import { generateGlobTasks } from "globby";
import micromatch from "micromatch";

import { createTextFile } from "../file/create-file.js";
import { ChronusError } from "../utils/errors.js";
import { execAsync, type ExecResult } from "../utils/exec-async.js";
import type { ChronusHost } from "../utils/host.js";
import { NodeIOError } from "../utils/node-host.js";
import {
  getBaseFileName,
  getDirectoryPath,
  getNormalizedAbsolutePath,
  normalizePath,
  resolvePath,
} from "../utils/path-utils.js";

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

  /** Get the merge base with the configured base remote branch. */
  getMergeBaseFromBase(baseBranch: string, baseRemote?: string): Promise<string>;

  /** Read the repository at a Git ref without changing the working tree. */
  getHostAtRef(ref: string): Promise<ChronusHost>;

  /**
   * Returns files changed since the given ref. Does not include any uncomitted file change.
   * @param dir Repository directory
   */
  listChangedFilesSince(ref: string): Promise<string[]>;

  /**
   * Returns files changed from the base remote branch.
   * @param dir Repository directory
   */
  listChangedFilesFromBase(baseBranch: string, baseRemote?: string): Promise<string[]>;

  /**
   * Get the name of the current local branch.
   */
  getCurrentBranch(): Promise<string>;

  /**
   * Return the commit ids that added the given files.
   */
  getCommitsThatAddFiles(files: string[]): Promise<Record<string, string>>;

  /**
   * Return the number of commits reachable from HEAD that touched the given path.
   * This count only ever grows as new commits are added (reverts are new commits), making it
   * suitable as a monotonic prerelease counter.
   *
   * Note: requires the full history to be available (e.g. `fetch-depth: 0` in CI). On a shallow
   * clone the count will be limited to the commits present in the clone.
   * ```bash
   * git rev-list --count HEAD -- <path>
   * ```
   * @param path Path (file or directory) to count commits for. Can be absolute or relative to the repository.
   */
  getCommitCountForPath(path: string): Promise<number>;
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
    getMergeBaseFromBase,
    getHostAtRef,
    listChangedFilesFromBase,
    listChangedFilesSince,
    getCurrentBranch,
    getCommitsThatAddFiles,
    getCommitCountForPath,
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
      await execGit(["ls-files", "--modified", "--others", "--exclude-standard"], {
        repositoryPath,
      }),
    );
  }

  async function listStagedFiles() {
    return splitStdoutLines(await execGit(["diff", "--relative", "--name-only", "--cached"], { repositoryPath }));
  }

  async function getMergeBase(ref: string) {
    const { stdout } = await execGit(["merge-base", "HEAD", ref], { repositoryPath });
    return stdout.toString().trim();
  }

  async function listChangedFilesFromBase(baseBranch: string, remote?: string) {
    return await listChangedFilesSince(await resolveBaseRef(baseBranch, remote));
  }

  async function getMergeBaseFromBase(baseBranch: string, remote?: string) {
    return await getMergeBase(await resolveBaseRef(baseBranch, remote));
  }

  async function resolveBaseRef(baseBranch: string, remote?: string) {
    let remoteBase: string | undefined;
    if (remote) {
      try {
        const remoteName = await findRemoteFromUrl(remote);
        if (remoteName !== undefined) {
          remoteBase = `${remoteName}/${baseBranch}`;
        }
      } catch {
        // ignore
      }
    } else {
      try {
        remoteBase = await findRemoteForBranch(baseBranch);
      } catch {
        // ignore
      }
    }
    if (remoteBase === undefined) {
      // Try remote tracking branch first, fall back to local branch if no remote exists
      try {
        await execGit(["rev-parse", "--verify", `refs/remotes/origin/${baseBranch}`], {
          repositoryPath,
        });
        remoteBase = `refs/remotes/origin/${baseBranch}`;
      } catch {
        // No remote, use local branch
        remoteBase = baseBranch;
      }
    }
    return remoteBase;
  }

  async function getHostAtRef(ref: string): Promise<ChronusHost> {
    const root = normalizePath(await getRepoRoot());
    const absolutePath = (path: string) => getNormalizedAbsolutePath(normalizePath(path), root);
    const { stdout } = await execGit(["ls-tree", "-r", "-z", "--full-tree", ref], {
      repositoryPath: root,
    });
    const files = new Map<string, { mode: string; objectId: string }>();
    const directories = new Set<string>([root]);
    for (const entry of stdout.toString().split("\0").filter(Boolean)) {
      const separator = entry.indexOf("\t");
      const [mode, type, objectId] = entry.slice(0, separator).split(" ");
      const path = absolutePath(entry.slice(separator + 1));
      if (type === "blob") {
        files.set(path, { mode, objectId });
      } else if (type === "commit") {
        directories.add(path);
      }
      let directory = getDirectoryPath(path);
      while (!directories.has(directory)) {
        directories.add(directory);
        directory = getDirectoryPath(directory);
      }
    }
    const children = new Map<string, string[]>();
    for (const path of [...directories, ...files.keys()]) {
      if (path === root) continue;
      const parent = getDirectoryPath(path);
      const entries = children.get(parent) ?? [];
      entries.push(path);
      children.set(parent, entries);
    }
    const contents = new Map<string, Promise<string>>();
    function readBlob(objectId: string): Promise<string> {
      let content = contents.get(objectId);
      if (content === undefined) {
        content = execGit(["cat-file", "blob", objectId], { repositoryPath: root }).then(({ stdout }) =>
          stdout.toString(),
        );
        contents.set(objectId, content);
      }
      return content;
    }

    async function resolveLinks(path: string): Promise<string> {
      let resolved = absolutePath(path);
      const visited = new Set<string>();
      for (let links = 0; ; links++) {
        if (links > 40 || visited.has(resolved)) {
          throw new NodeIOError("ELOOP", `Too many symbolic links resolving '${path}' at Git ref '${ref}'.`);
        }
        visited.add(resolved);
        const parts = normalizePath(relative(root, resolved)).split("/");
        let current = root;
        let target: string | undefined;
        for (const [index, part] of parts.entries()) {
          current = absolutePath(resolvePath(current, part));
          const entry = files.get(current);
          if (entry?.mode === "120000") {
            const link = await readBlob(entry.objectId);
            if (link.length === 0) break;
            target = absolutePath(resolvePath(getDirectoryPath(current), link, ...parts.slice(index + 1)));
            break;
          }
        }
        if (target !== undefined) {
          resolved = target;
          continue;
        }
        if (directories.has(resolved) || (files.has(resolved) && files.get(resolved)?.mode !== "120000")) {
          return resolved;
        }
        throw new NodeIOError("ENOENT", `Path '${path}' does not exist at Git ref '${ref}'.`);
      }
    }

    async function readOnly(): Promise<never> {
      throw new ChronusError(`Cannot modify the repository at Git ref '${ref}'.`);
    }

    return {
      async readFile(path) {
        const resolved = await resolveLinks(path);
        const entry = files.get(resolved);
        if (entry === undefined) {
          throw new NodeIOError("EISDIR", `Path '${path}' is a directory at Git ref '${ref}'.`);
        }
        return createTextFile(await readBlob(entry.objectId), absolutePath(path));
      },
      async access(path) {
        await resolveLinks(path);
      },
      async glob(pattern, options) {
        const paths: string[] = [];
        async function visit(path: string, name: string, ancestors: ReadonlySet<string>): Promise<void> {
          if (options?.ignore?.length && micromatch.isMatch(name, options.ignore, { dot: true })) return;
          let resolved: string;
          try {
            resolved = await resolveLinks(path);
          } catch (error) {
            // Like filesystem globbing, omit dangling links and links that cannot be followed.
            if (error instanceof NodeIOError && (error.code === "ENOENT" || error.code === "ELOOP")) return;
            throw error;
          }
          const directory = directories.has(resolved);
          if (directory === (options?.onlyDirectories ?? false)) paths.push(name);
          if (!directory || ancestors.has(resolved)) return;
          const next = new Set(ancestors).add(resolved);
          for (const child of children.get(resolved) ?? []) {
            const childName = getBaseFileName(child);
            await visit(child, name === "." ? childName : `${name}/${childName}`, next);
          }
        }
        await visit(absolutePath(options?.baseDir ?? root), ".", new Set());
        const patterns = (Array.isArray(pattern) ? pattern : [pattern]).map((path) => {
          let end = path.length;
          while (end > 0 && path[end - 1] === "/") {
            end--;
          }
          return path.slice(0, end);
        });
        const tasks = await generateGlobTasks(patterns, { expandDirectories: false, ignore: options?.ignore });
        const matches = new Set<string>();
        for (const task of tasks) {
          const ignored = (task.options.ignore ?? []).map((pattern) => micromatch.matcher(pattern, { dot: true }));
          for (const pattern of task.patterns) {
            const scan = micromatch.scan(pattern);
            for (const path of micromatch(paths, pattern)) {
              // Directory traversal does not return the search root of a dynamic pattern.
              if (scan.isGlob && path === (normalizePath(scan.base) || ".")) continue;
              let current = path;
              while (current && !ignored.some((match) => match(current))) {
                const parent = getDirectoryPath(current);
                if (parent === current) break;
                current = parent;
              }
              if (!current) matches.add(path);
            }
          }
        }
        return [...matches];
      },
      writeFile: readOnly,
      rm: readOnly,
      mkdir: readOnly,
    };
  }

  async function listChangedFilesSince(ref: string) {
    return splitStdoutLines(await execGit(["diff", "--relative", "--name-only", `${ref}...`], { repositoryPath }));
  }

  async function findRemoteForBranch(branch: string) {
    const ref = splitStdoutLines(await execGit(["rev-parse", `--symbolic-full-name`, branch], { repositoryPath }))[0];
    return splitStdoutLines(
      await execGit(["for-each-ref", "--format", "%(upstream:short)", ref], { repositoryPath }),
    )[0];
  }

  async function findRemoteFromUrl(remoteUrl: string) {
    const remotes = splitStdoutLines(await execGit(["remote", `--v`], { repositoryPath }));
    return remotes.find((remote) => remote.includes(remoteUrl))?.split("\t")[0];
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
            await execGit(["log", "--diff-filter=A", "--max-count=1", "--format=%H:%p", gitPath], {
              repositoryPath,
            }),
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

  async function getCommitCountForPath(path: string): Promise<number> {
    const result = await execGit(["rev-list", "--count", "HEAD", "--", path], { repositoryPath });
    const count = Number.parseInt(trimSingleLine(result), 10);
    return Number.isNaN(count) ? 0 : count;
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
