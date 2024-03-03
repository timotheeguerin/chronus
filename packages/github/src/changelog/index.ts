import { type ChronusWorkspace } from "@chronus/chronus";
import { resolveChangeRelativePath, type ChangeDescription } from "@chronus/chronus/change";
import { BasicChangelogGenerator, defineChangelogGenerator } from "@chronus/chronus/changelog";
import { createGitSourceControl } from "@chronus/chronus/source-control/git";
import { ChronusError, execAsync } from "@chronus/chronus/utils";
import type { ChangelogGeneratorInit } from "../../../chronus/dist/changelog/types.js";
import { getGithubInfoForChange, type GithubInfo } from "./fetch-pr-info.js";

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

async function getGithubToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  } else {
    const result = await execAsync("gh", ["auth", "token"]);
    if (result.code === 0) {
      return result.stdout.toString().trim();
    } else {
      throw new ChronusError(`Failed to get github token:${result.stdall}`);
    }
  }
}

export interface GithubChangelogGeneratorOptions {
  readonly repo: string;
}
export default defineChangelogGenerator(
  async ({ workspace, changes, options }: ChangelogGeneratorInit<GithubChangelogGeneratorOptions>) => {
    if (!options?.repo) {
      throw new ChronusError("Missing repo option");
    }

    const commits = await getCommitsThatAddChangeDescriptions(
      workspace,
      changes.map((c) => c.id),
    );
    const [owner, name] = options.repo.split("/", 2);
    const data = await getGithubInfoForChange(owner, name, commits, await getGithubToken());
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
    const pr = githubInfo?.pullRequest ? `#${githubInfo.pullRequest.number} ` : "";
    const commit = githubInfo?.commit ? `${githubInfo.commit} ` : "";
    return `- ${pr}${commit}${change.content}`;
  }
}
