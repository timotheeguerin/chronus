import { readFileSync } from "fs";
import type { CIContext } from "./types.js";

interface GithubEnvironment {
  repo?: string;
  eventName?: string;
  sha?: string;
  ref?: string;
  workflow?: string;
  action?: string;
  actor?: string;
  job?: string;
  runAttempt?: number;
  runNumber?: number;
  runId?: number;
  payload?: any;
}
function getGithubEnvironment(): GithubEnvironment {
  let payload;

  if (process.env.GITHUB_EVENT_PATH) {
    try {
      payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, { encoding: "utf8" }));
    } catch (e) {
      if (!((e as any).code === "ENOENT")) {
        throw e;
      }
    }
  }
  return {
    eventName: process.env.GITHUB_EVENT_NAME,
    repo: process.env.GITHUB_REPOSITORY,
    sha: process.env.GITHUB_SHA,
    ref: process.env.GITHUB_REF,
    workflow: process.env.GITHUB_WORKFLOW,
    action: process.env.GITHUB_ACTION,
    actor: process.env.GITHUB_ACTOR,
    job: process.env.GITHUB_JOB,
    runAttempt: parseInt(process.env.GITHUB_RUN_ATTEMPT as string, 10),
    runNumber: parseInt(process.env.GITHUB_RUN_NUMBER as string, 10),
    runId: parseInt(process.env.GITHUB_RUN_ID as string, 10),
    payload,
  };
}

export function getGithubContext(): CIContext | undefined {
  const githubEnv = getGithubEnvironment();
  if (githubEnv.eventName !== "pull_request" && githubEnv.eventName !== "pull_request_target") {
    return undefined;
  }
  if (githubEnv.payload.pull_request === undefined) {
    throw new Error("Cannot run outside of a pull request");
  }
  return {
    repo: githubEnv.repo,
    prNumber: githubEnv.payload.pull_request.number,
    headRef: githubEnv.payload.pull_request.head.ref,
    prTitle: githubEnv.payload.pull_request.title,
  };
}
