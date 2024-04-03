import { type ChronusWorkspace } from "@chronus/chronus";
import { resolveChangeRelativePath } from "@chronus/chronus/change";
import { defineChangelogGenerator } from "@chronus/chronus/changelog";
import { createGitSourceControl } from "@chronus/chronus/source-control/git";
import { ChronusError } from "@chronus/chronus/utils";
import type { ChangelogGeneratorInit } from "../../../chronus/dist/changelog/types.js";
import { getGithubToken } from "../utils/gh-token.js";
import { getGithubInfoForChange } from "./fetch-pr-info.js";
import { GithubChangelogGenerator } from "./github-changelog-generator.js";

async function getCommitsThatAddChangeDescriptions(
  workspace: ChronusWorkspace,
  changeDescriptionsFilename: string[],
): Promise<Record<string, string>> {
  const git = createGitSourceControl(workspace.path);
  const paths = changeDescriptionsFilename.map((id) => resolveChangeRelativePath(id));
  const commits = await git.getCommitsThatAddFiles(paths);

  const result: Record<string, string> = {};
  for (const changeId of changeDescriptionsFilename) {
    const commit = commits[resolveChangeRelativePath(changeId)];
    if (commit) {
      result[changeId] = commit;
    }
  }
  return result;
}

export interface GithubChangelogGeneratorOptions {
  readonly repo: string;
}
export default defineChangelogGenerator(
  async ({ workspace, changes, options, interactive }: ChangelogGeneratorInit<GithubChangelogGeneratorOptions>) => {
    if (!options?.repo) {
      throw new ChronusError("Missing repo option");
    }

    const commits = await getCommitsThatAddChangeDescriptions(
      workspace,
      changes.map((c) => c.id),
    );
    const [owner, name] = options.repo.split("/", 2);
    const data = await getGithubInfoForChange(owner, name, commits, await getGithubToken(interactive));
    return new GithubChangelogGenerator(workspace, data);
  },
);
