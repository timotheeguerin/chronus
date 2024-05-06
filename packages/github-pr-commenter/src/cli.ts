/* eslint-disable no-console */
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await import("source-map-support/register.js");
} catch {
  // package only present in dev.
}
import { getPullRequestContext, type PullRequestContext } from "@chronus/github/pull-requests/context";
import { Octokit } from "@octokit/rest";
import { readFile } from "fs/promises";
import { parseArgs } from "util";

const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    "comment-file": {
      type: "string",
    },
  },
});

const commentFile = args.values["comment-file"];
const magicString = "<!--chronus-github-change-commenter-->";

async function getCommentContent(context: PullRequestContext) {
  if (commentFile) {
    const buffer = await readFile(commentFile, "utf-8");
    return buffer.toString();
  } else {
    const { resolveChangeStatusCommentForPr } = await import(/* @vite-ignore */ "@chronus/github");
    return await resolveChangeStatusCommentForPr(context);
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  const context = getPullRequestContext();

  const github = new Octokit({
    auth: `token ${token}`,
  });

  const content = await getCommentContent(context);
  console.log("Comment:");
  console.log("-".repeat(100));
  console.log(content);
  console.log("-".repeat(100));

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
