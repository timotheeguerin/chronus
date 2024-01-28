try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await import("source-map-support/register.js");
} catch {
  // package only present in dev.
}
import { context, getOctokit } from "@actions/github";

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

const magicString = "<!--chronus-github-change-commenter-->";
async function main() {
  const prNumber = process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER;
  log("PR number", prNumber);
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  const github = getOctokit(token);

  const content = [magicString, "Test comment"];

  github.rest.issues.createComment({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: content.join("\n"),
  });
}

await main();
