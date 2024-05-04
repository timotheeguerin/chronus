import type { CIContext } from "./types.js";

export function getGenericContext(): CIContext {
  return {
    prNumber: process.env["GH_PR_NUMBER"] ? parseInt(process.env["GH_PR_NUMBER"], 10) : undefined,
    repo: process.env["GH_REPO"],
    headRef: process.env["GH_PR_HEAD_REF"],
    prTitle: process.env["GH_PR_TITLE"],
  };
}
