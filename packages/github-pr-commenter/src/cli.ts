import { createActionAuth } from "@octokit/auth-action";
import { Octokit } from "octokit";
import "source-map-support/register.js";

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

async function main() {
  const prNumber = process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER;
  log("PR number", prNumber);
  console.log("ENvs", process.env);
  const github = new Octokit({ auth: createActionAuth() });

  // github.rest.issues.createComment({
  //   issue_number: context.issue.number,
  //   owner: context.repo.owner,
  //   repo: context.repo.repo,
  //   body: [].join("\n"),
  // });
}

await main();
