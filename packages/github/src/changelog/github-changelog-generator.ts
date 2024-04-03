import { type ChronusWorkspace } from "@chronus/chronus";
import { type ChangeDescription } from "@chronus/chronus/change";
import { BasicChangelogGenerator } from "@chronus/chronus/changelog";
import { type GithubInfo, type GithubPrRef } from "./fetch-pr-info.js";

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
