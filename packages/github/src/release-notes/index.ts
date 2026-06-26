import { type ChronusWorkspace } from "@chronus/chronus";
import { resolveChangeRelativePath } from "@chronus/chronus/change";
import type { ReleaseNotesChange, ReleaseNotesContextEnricher } from "@chronus/chronus/release-notes";
import { createGitSourceControl } from "@chronus/chronus/source-control/git";

import { getGithubInfoForChange } from "../changelog/fetch-pr-info.js";
import { getGithubToken } from "../utils/gh-token.js";

export interface GithubReleaseNotesEnricherOptions {
  readonly repo: string;
}

/**
 * Enriches release notes changes with GitHub PR info (number, URL, author).
 */
export function createGithubReleaseNotesEnricher(
  options: GithubReleaseNotesEnricherOptions,
): ReleaseNotesContextEnricher {
  return {
    name: "@chronus/github/release-notes",
    async enrichChanges(changes: ReleaseNotesChange[], workspace: ChronusWorkspace): Promise<ReleaseNotesChange[]> {
      if (!options?.repo) {
        return changes;
      }

      const [owner, repoName] = options.repo.split("/", 2);
      const git = createGitSourceControl(workspace.path);

      // Find commits that introduced each change file
      const paths = changes.map((c) => resolveChangeRelativePath(c.id));
      const commits = await git.getCommitsThatAddFiles(paths);

      const commitMap: Record<string, string> = {};
      for (const change of changes) {
        const commit = commits[resolveChangeRelativePath(change.id)];
        if (commit) {
          commitMap[change.id] = commit;
        }
      }

      // Fetch GitHub info for those commits
      let githubToken: string;
      try {
        githubToken = await getGithubToken(false);
      } catch {
        // No token available, skip enrichment
        return changes;
      }

      const githubInfo = await getGithubInfoForChange(owner, repoName, commitMap, githubToken);

      // Attach metadata to changes
      return changes.map((change) => {
        const info = githubInfo[change.id];
        if (!info) return change;

        return {
          ...change,
          metadata: {
            ...change.metadata,
            ...(info.pullRequest && {
              prNumber: info.pullRequest.number,
              prUrl: info.pullRequest.url,
            }),
            ...(info.author && {
              author: info.author.login,
              authorUrl: info.author.url,
            }),
            commit: info.commit,
            commitUrl: info.commitUrl,
          },
        };
      });
    },
  };
}

export default createGithubReleaseNotesEnricher;
