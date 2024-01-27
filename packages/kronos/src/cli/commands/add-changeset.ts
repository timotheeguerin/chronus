import { NodeKronosHost } from "../../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../../workspace-manager/pnpm.js";

export async function addChangeset(cwd: string): Promise<void> {
  const host = NodeKronosHost;
  const pnpm = createPnpmWorkspaceManager(host);
  const packages = await pnpm.load(cwd);
  // eslint-disable-next-line no-console
  console.log("Packages", packages);
}
