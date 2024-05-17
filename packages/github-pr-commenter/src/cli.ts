/* eslint-disable no-console */
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await import("source-map-support/register.js");
} catch {
  // package only present in dev.
}
import type { ChangeStatusComment } from "@chronus/github/pull-requests";
import { Octokit } from "@octokit/rest";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const magicString = "<!--chronus-github-change-commenter-->";

const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    "comment-file": {
      type: "string",
    },
  },
});

const commentFile = args.values["comment-file"];

async function getCommentContent(): Promise<ChangeStatusComment> {
  if (commentFile) {
    const buffer = await readFile(commentFile, "utf-8");
    const data = JSON.parse(buffer.toString());
    return data;
  } else {
    const { resolveChangeStatusCommentForPr, getPullRequestContext } = await import("@chronus/github/pull-requests");
    const context = getPullRequestContext();
    return await resolveChangeStatusCommentForPr(context);
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  const github = new Octokit({
    auth: `token ${token}`,
  });

  const data = await getCommentContent();
  console.log("Comment:");
  console.log("-".repeat(100));
  console.log(data);
  console.log("-".repeat(100));

  const comments = await github.rest.issues.listComments({
    issue_number: data.prNumber,
    owner: data.repo.owner,
    repo: data.repo.name,
  });
  const existingComment = comments.data.find((x) => x.body?.includes(magicString));

  if (existingComment) {
    await github.rest.issues.updateComment({
      comment_id: existingComment.id,
      owner: data.repo.owner,
      repo: data.repo.name,
      body: data.content,
    });
  } else {
    await github.rest.issues.createComment({
      issue_number: data.prNumber,
      owner: data.repo.owner,
      repo: data.repo.name,
      body: data.content,
    });
  }
}

await main();
