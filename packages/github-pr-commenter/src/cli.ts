try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await import("source-map-support/register.js");
} catch {
  // package only present in dev.
}
import { context, getOctokit } from "@actions/github";
import type { ChangeStatus } from "@chronus/chronus";
import { getWorkspaceStatus } from "@chronus/chronus";

const magicString = "<!--chronus-github-change-commenter-->";
async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  const github = getOctokit(token);

  const status = await getWorkspaceStatus(process.cwd());

  const content = resolveComment(status);

  const comments = await github.rest.issues.listComments({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
  });
  const existingComment = comments.data.find((x) => x.body?.includes(magicString));

  if (existingComment) {
    github.rest.issues.updateComment({
      comment_id: existingComment.id,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: content,
    });
  } else {
    github.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: content,
    });
  }
}

function resolveComment(status: ChangeStatus): string {
  const undocummentedPackages = [...status.packages.values()].filter((x) => x.changed && !x.documented);
  const documentedPackages = [...status.packages.values()].filter((x) => x.changed && x.documented);

  const content = [magicString];

  if (undocummentedPackages.length > 0) {
    content.push(`:x: There is undocummented changes. Run \`chronus add\` to add a changeset.`);
    content.push("");
    content.push(`**The following packages have changes but are not documented.**`);
    for (const pkg of undocummentedPackages) {
      content.push(` - ${pkg.package.name}`);
    }

    if (documentedPackages.length > 0) {
      content.push("");
      content.push(`**:heavy_check_mark: The following packages have already been documented:**`);

      for (const pkg of documentedPackages) {
        content.push(` - ${pkg.package.name}`);
      }
    }
    content.push("");
  } else {
    content.push(`**All changed packages have been documented!**`);
  }
  return content.join("\n");
}

await main();
