import micromatch from "micromatch";

import { createGitSourceControl } from "../source-control/git.js";
import { getCIContext, type CIContext } from "../utils/ci-context.js";
import type { ChronusWorkspace } from "../workspace/types.js";

/** Return the configured reason to waive only the new-changeset requirement. */
export async function getChangesetRequirementExemption(
  workspace: ChronusWorkspace,
  prContext?: Pick<CIContext, "headRef" | "prTitle">,
): Promise<string | undefined> {
  const requirement = workspace.config.verify?.changesetRequirement;
  if (
    requirement === undefined ||
    (!requirement.excludeBranches?.length && !requirement.excludeTitleContains?.length)
  ) {
    return undefined;
  }

  const context = prContext ?? getCIContext();
  if (requirement.excludeBranches?.length) {
    const headRef = context.headRef ?? (await createGitSourceControl(workspace.path).getCurrentBranch());
    const branch = headRef.startsWith("refs/heads/") ? headRef.slice("refs/heads/".length) : headRef;
    const pattern = requirement.excludeBranches.find((pattern) => micromatch.isMatch(branch, pattern));
    if (pattern !== undefined) {
      return `source branch '${branch}' matches '${pattern}'`;
    }
  }

  if (context.prTitle !== undefined) {
    const title = context.prTitle.toLowerCase();
    const fragment = requirement.excludeTitleContains?.find((fragment) => title.includes(fragment.toLowerCase()));
    if (fragment !== undefined) {
      return `PR title contains '${fragment}'`;
    }
  }
  return undefined;
}
