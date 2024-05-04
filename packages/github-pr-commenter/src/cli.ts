try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await import("source-map-support/register.js");
} catch {
  // package only present in dev.
}
import type { ChangeStatus, ChronusWorkspace, PackageStatus } from "@chronus/chronus";
import { NodeChronusHost, getWorkspaceStatus, loadChronusWorkspace } from "@chronus/chronus";
import { printChangeDescription, resolveChangeRelativePath, type ChangeDescription } from "@chronus/chronus/change";
import { Octokit } from "octokit";
import { getContext } from "./contexts/index.js";
import type { Context } from "./contexts/types.js";
import { collapsibleSection } from "./markdown.js";

const magicString = "<!--chronus-github-change-commenter-->";
async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  const context = getContext();

  const github = new Octokit({
    auth: `token ${token}`,
  });

  const pr = await github.rest.pulls.get({
    pull_number: context.prNumber,
    owner: context.repo.owner,
    repo: context.repo.name,
  });
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, process.cwd());
  const status = await getWorkspaceStatus(host, workspace);

  if (!context.prTitle) {
    context.prTitle = pr.data.title;
  }

  const content = resolveComment(workspace, status, pr.data, context as any);

  const comments = await github.rest.issues.listComments({
    issue_number: context.prNumber,
    owner: context.repo.owner,
    repo: context.repo.name,
  });
  const existingComment = comments.data.find((x) => x.body?.includes(magicString));

  if (existingComment) {
    await github.rest.issues.updateComment({
      comment_id: existingComment.id,
      owner: context.repo.owner,
      repo: context.repo.name,
      body: content,
    });
  } else {
    await github.rest.issues.createComment({
      issue_number: context.prNumber,
      owner: context.repo.owner,
      repo: context.repo.name,
      body: content,
    });
  }
}

function resolveComment(
  workspace: ChronusWorkspace,
  status: ChangeStatus,
  pr: any,
  context: Required<Context>,
): string {
  const undocummentedPackages = [...status.packages.values()].filter((x) => x.changed && !x.documented);
  const documentedPackages = [...status.packages.values()].filter((x) => x.changed && x.documented);

  const content = [magicString];

  if (undocummentedPackages.length > 0) {
    content.push(
      `:x: There is undocummented changes. Run \`chronus add\` to add a changeset or [click here](${newChangeDescriptionUrl(workspace, undocummentedPackages, pr, context)}).`,
    );
    content.push("");
    content.push(`**The following packages have changes but are not documented.**`);
    for (const pkg of undocummentedPackages) {
      content.push(` - :x:\`${pkg.package.name}\``);
    }

    if (documentedPackages.length > 0) {
      content.push("");
      content.push(`The following packages have already been documented:`);

      for (const pkg of documentedPackages) {
        content.push(` - :white_check_mark: \`${pkg.package.name}\``);
      }
    }
    content.push("");
    content.push(showChanges(status, pr, context));
  } else if (documentedPackages.length > 0) {
    content.push(`All changed packages have been documented.`);
    for (const pkg of documentedPackages) {
      content.push(` - :white_check_mark: \`${pkg.package.name}\``);
    }
    content.push("");
    content.push(showChanges(status, pr, context));
  } else {
    content.push(`No changes needing a change description found.`);
  }
  return content.join("\n");
}

function showChanges(status: ChangeStatus, pr: any, context: Context) {
  const summaries = status.all.changeDescriptions
    .flatMap((change) => {
      return change.packages.flatMap((pkgName) => {
        const editLink = `[✏️](${editChangeDescriptionUrl(change, pr, context)})`;
        return [
          `### \`${pkgName}\` - _${change.changeKind.name}_ ${editLink}`,
          change.content.split("\n").map((x) => `> ${x}`),
        ];
      });
    })
    .join("\n");
  return collapsibleSection("Show changes", summaries);
}

function newChangeDescriptionUrl(
  workspace: ChronusWorkspace,
  undocummentedPackages: PackageStatus[],
  pr: any,
  context: Required<Context>,
): string {
  const repoUrl = pr.head.repo.html_url;

  const date = new Date();
  const id = [
    context.headRef.replace(/\//g, "-"),
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ].join("-");
  const filename = resolveChangeRelativePath(id);
  const content = printChangeDescription(
    {
      changeKind: getDefaultChangeKind(workspace),
      packages: undocummentedPackages.map((x) => x.package.name),
      content: context.prTitle,
    },
    { frontMatterComment: `Change versionKind to one of: ${Object.keys(workspace.config.changeKinds).join(", ")}` },
  );
  return `${repoUrl}/new/${context.headRef}?filename=${filename}&value=${encodeURIComponent(content)}`;
}

function editChangeDescriptionUrl(change: ChangeDescription, pr: any, context: Context) {
  const repoUrl = pr.head.repo.html_url;
  const prRef = `/${context.repo.owner}/${context.repo.name}/pull/${context.prNumber}`;

  return `${repoUrl}/edit/${context.headRef}/.chronus/changes/${change.id}.md?pr=${prRef}`;
}

function getDefaultChangeKind(workspace: ChronusWorkspace): any {
  const changeKinds = Object.values(workspace.config.changeKinds);
  const patch = changeKinds.find((x) => x.versionType === "patch");
  if (patch) return patch;
  const none = changeKinds.find((x) => x.versionType === "none");
  if (none) return none;
  return changeKinds[0];
}

await main();
