import { readFileSync } from "node:fs";

import { ChronusUserError } from "./errors.js";

export interface CIContext {
  readonly repo?: string;
  readonly prNumber?: number;
  readonly headRef?: string;
  readonly prTitle?: string;
}

/** Resolve optional PR metadata from GitHub, Azure DevOps, or explicit GH_PR_* environment variables. */
export function getCIContext(): CIContext {
  const provider = getGithubContext() ?? getAzureDevopsContext();
  const explicit = getGenericContext();
  return {
    repo: provider?.repo ?? explicit.repo,
    prNumber: provider?.prNumber ?? explicit.prNumber,
    headRef: provider?.headRef ?? explicit.headRef,
    prTitle: provider?.prTitle ?? explicit.prTitle,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getGithubContext(): CIContext | undefined {
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (eventName !== "pull_request" && eventName !== "pull_request_target") {
    return undefined;
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath === undefined) {
    return {
      repo: process.env.GITHUB_REPOSITORY,
      headRef: process.env.GITHUB_HEAD_REF,
    };
  }

  const payload: unknown = JSON.parse(readFileSync(eventPath, "utf8"));
  if (!isRecord(payload) || !isRecord(payload.pull_request)) {
    throw new ChronusUserError("GitHub pull request event is missing 'pull_request' metadata.");
  }
  const pr = payload.pull_request;
  return {
    repo: process.env.GITHUB_REPOSITORY,
    prNumber: typeof pr.number === "number" ? pr.number : undefined,
    headRef: isRecord(pr.head) && typeof pr.head.ref === "string" ? pr.head.ref : process.env.GITHUB_HEAD_REF,
    prTitle: typeof pr.title === "string" ? pr.title : undefined,
  };
}

function getAzureDevopsContext(): CIContext | undefined {
  const number = process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER;
  const prNumber = number === undefined ? undefined : Number.parseInt(number, 10);
  const repo = process.env.BUILD_REPOSITORY_NAME;
  const headRef = process.env.SYSTEM_PULLREQUEST_SOURCEBRANCH;
  return prNumber && repo && headRef ? { prNumber, repo, headRef } : undefined;
}

function getGenericContext(): CIContext {
  return {
    prNumber: process.env.GH_PR_NUMBER ? Number.parseInt(process.env.GH_PR_NUMBER, 10) : undefined,
    repo: process.env.GH_REPO,
    headRef: process.env.GH_PR_HEAD_REF,
    prTitle: process.env.GH_PR_TITLE,
  };
}
