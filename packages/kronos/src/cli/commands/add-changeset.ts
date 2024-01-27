import { createGitSourceControl } from "../../source-control/git.js";
import { NodeKronosHost } from "../../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../../workspace-manager/pnpm.js";
import type { Package } from "../../workspace-manager/types.js";
import prompts from "prompts";

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
export async function addChangeset(cwd: string): Promise<void> {
  const host = NodeKronosHost;
  const pnpm = createPnpmWorkspaceManager(host);
  const workspace = await pnpm.load(cwd);
  const sourceControl = createGitSourceControl(workspace.path);
  const filesChanged = await sourceControl.listChangedFilesFromBase();

  const publicPackages = workspace.packages.filter((x) => !x.manifest.private);
  const packageChanged = findPackageChanges(publicPackages, filesChanged);

  console.log(
    "Packages changed",
    packageChanged.map((x) => x.name),
  );
  const packageToInclude = await promptForPackages(publicPackages, packageChanged);

  if (packageToInclude.length === 0) {
    log("No package selected. Exiting.");
    return;
  }
  console.log(
    "Packages to include in changeset",
    packageToInclude.map((x) => x.name),
  );
}

function findPackageChanges(packages: Package[], fileChanged: string[]): Package[] {
  const packageChanged = new Set<Package>();

  for (const file of fileChanged) {
    const pkg = packages.find((x) => file.startsWith(x.relativePath + "/"));
    if (pkg) {
      packageChanged.add(pkg);
    }
  }
  return [...packageChanged];
}

async function promptForPackages(allPackages: Package[], packageChanged: Package[]): Promise<Package[]> {
  const response = await prompts({
    type: "multiselect",
    name: "value",
    instructions: false,
    message: "Select packages to include in this changeset",
    choices: packageChanged.map((x) => ({ title: x.name, value: x })),
  });
  return response.value;
}
