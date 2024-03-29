import { type ChronusWorkspace } from "@chronus/chronus";
import { resolveChangeRelativePath, type ChangeDescription } from "@chronus/chronus/change";
import { BasicChangelogGenerator, defineChangelogGenerator } from "@chronus/chronus/changelog";
import { createGitSourceControl } from "@chronus/chronus/source-control/git";
import { ChronusError } from "@chronus/chronus/utils";
import type { ChangelogGeneratorInit } from "../../../chronus/dist/changelog/types.js";
import { getGithubToken } from "../utils/gh-token.js";
import { getGithubInfoForChange, type GithubInfo, type GithubPrRef } from "./fetch-pr-info.js";

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
    return {
      async loadData(changes: ChangeDescription[]) {},
      renderPackageVersion(newVersion: string, changes: ChangeDescription[]) {
        const renderer = new GithubChangelogGenerator(workspace, data);
        return renderer.renderPackageVersion(newVersion, changes);
      },
    };
  },
);

export class GithubChangelogGenerator extends BasicChangelogGenerator {
  constructor(
    workspace: ChronusWorkspace,
    protected readonly data: Record<string, GithubInfo>,
  ) {
    super(workspace);
  }

  override renderEntry(change: ChangeDescription) {
    const githubInfo = this.data[change.id];
    const prefix = githubInfo?.pullRequest
      ? `${this.renderPrLink(githubInfo.pullRequest)} `
      : githubInfo?.commit
        ? `${this.renderCommitLink(githubInfo)} `
        : "";
    return `- ${prefix}${change.content}`;
  }

  renderPrLink(pr: GithubPrRef) {
    return `[#${pr.number}](${pr.url})`;
  }

  renderCommitLink(githubInfo: GithubInfo) {
    return `[${githubInfo.commit.slice(0, 7)}](${githubInfo.commitUrl})`;
  }
}
