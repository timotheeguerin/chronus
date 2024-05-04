import { getAzureDevopsContext } from "./azure-devops.js";
import { getGenericContext } from "./generic.js";
import { getGithubContext } from "./github.js";
import type { Context } from "./types.js";

export function getContext(): Context {
  const context = getGithubContext() ?? getAzureDevopsContext() ?? getGenericContext();

  // eslint-disable-next-line no-console
  console.log("Resolved context", context);
  if (!context?.prNumber) {
    throw new Error("PR number not found. Set $GH_PR_NUMBER");
  }

  if (context?.repo === undefined) {
    throw new Error("Repo not found. Set $GH_REPO");
  }
  if (!context?.headRef) {
    throw new Error("Head ref not found. Set $GH_PR_HEAD_REF");
  }

  const [repoOwner, repoName] = context.repo.split("/");
  return {
    repo: { owner: repoOwner, name: repoName },
    prNumber: context.prNumber,
    headRef: context.headRef,
    prTitle: context.prTitle,
  };
}
