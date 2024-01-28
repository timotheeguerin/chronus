import pc from "picocolors";
import { findChangeStatus } from "../../change/index.js";
import { createGitSourceControl } from "../../source-control/git.js";
import { NodechronusHost } from "../../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../../workspace-manager/pnpm.js";
function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
export async function verifyChangeset(cwd: string): Promise<void> {
  const host = NodechronusHost;
  const pnpm = createPnpmWorkspaceManager(host);
  const workspace = await pnpm.load(cwd);
  const sourceControl = createGitSourceControl(workspace.path);
  const status = await findChangeStatus(host, sourceControl, workspace);

  const undocummentedPackages = [...status.packages.values()].filter((x) => x.changed && !x.documented);
  const documentedPackages = [...status.packages.values()].filter((x) => x.changed && x.documented);
  if (undocummentedPackages.length > 0) {
    log(`There is undocummented changes. Run ${pc.cyan("chronus add")} to add a changeset.`);
    log("");
    log(pc.red(`The following packages have changes but are not documented.`));
    for (const pkg of undocummentedPackages) {
      log(pc.red(` - ${pkg.package.name}`));
    }

    if (documentedPackages.length > 0) {
      log("");
      log(pc.green("The following packages have already been documented:"));

      for (const pkg of documentedPackages) {
        log(pc.green(` - ${pkg.package.name}`));
      }
    }
    log("");
    process.exit(1);
  }

  log(pc.green("All changed packages have been documented:"));
  for (const pkg of documentedPackages) {
    log(pc.green(` - ${pkg.package.name}`));
  }
}
