try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await import("source-map-support/register.js");
} catch {
  // package only present in dev.
}
import { getPullRequestContext, resolveChangeStatusCommentForPr } from "@chronus/github";
import { Octokit } from "@octokit/rest";

const magicString = "<!--chronus-github-change-commenter TEST REVERT-->";
async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  const context = getPullRequestContext();
  const content = await resolveChangeStatusCommentForPr(context);

  const github = new Octokit({
    auth: `token ${token}`,
  });

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

await main();
