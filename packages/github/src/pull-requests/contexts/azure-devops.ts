import type { CIContext } from "./types.js";

export function getAzureDevopsContext(): CIContext | undefined {
  const values = {
    prNumber: parseInt(process.env["SYSTEM_PULLREQUEST_PULLREQUESTNUMBER"] as string, 10),
    repo: process.env["BUILD_REPOSITORY_NAME"],
    headRef: process.env["SYSTEM_PULLREQUEST_SOURCEBRANCH"],
  };

  return values.prNumber && values.repo && values.headRef ? values : undefined;
}
