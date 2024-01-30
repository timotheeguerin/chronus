import writeChangeset from "@changesets/write";
import pc from "picocolors";
import prompts from "prompts";
import type { ChangeStatus } from "../../change/find.js";
import { findChangeStatus } from "../../change/index.js";
import { resolveConfig } from "../../config/parse.js";
import { createGitSourceControl } from "../../source-control/git.js";
import { NodechronusHost } from "../../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../../workspace-manager/pnpm.js";
import type { Package } from "../../workspace-manager/types.js";

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
export async function addChangeset(cwd: string): Promise<void> {
  const host = NodechronusHost;
  const config = await resolveConfig(host, cwd);
  const pnpm = createPnpmWorkspaceManager(host);
  const workspace = await pnpm.load(cwd);
  const sourceControl = createGitSourceControl(workspace.path);
  const status = await findChangeStatus(host, sourceControl, workspace, config);
  if (status.committed.packageChanged.length === 0) {
    log("No package changed. Exiting.\n");
    return;
  }
  const packageToInclude = await promptForPackages(status);

  if (packageToInclude.length === 0) {
    log("No package selected. Exiting.\n");
    return;
  }
  const changeType = await promptBumpType();
  const changesetContent = await promptForContent();

  const result = await writeChangeset(
    {
      summary: changesetContent,
      releases: packageToInclude.map((x) => ({ name: x.name, type: changeType })),
    },
    workspace.path,
  );
  log("Wrote changeset ", result);
}

async function promptForPackages(status: ChangeStatus): Promise<Package[]> {
  const undocummentedPackages = status.committed.packageChanged.filter(
    (x) => !status.all.packagesDocumented.find((y) => x.name === y.name),
  );
  const documentedPackages = status.committed.packageChanged.filter((x) =>
    status.all.packagesDocumented.find((y) => x.name === y.name),
  );

  const response = await prompts({
    type: "multiselect",
    name: "value",
    instructions: false,
    message: "Select packages to include in this changeset",
    choices: [
      ...undocummentedPackages.map((x) => ({
        title: x.name,
        value: x,
      })),
      ...documentedPackages.map((x) => ({
        title: `${x.name} ${pc.green("(Already documented)")}`,
        value: x,
      })),
    ],
  });
  return response.value;
}

async function promptBumpType(): Promise<"major" | "minor" | "patch" | "none"> {
  const response = await prompts({
    type: "select",
    name: "value",
    instructions: false,
    message: "Describe the type of change",
    choices: [
      { title: "none", value: "none" },
      { title: "patch", value: "patch" },
      { title: "minor", value: "minor" },
      { title: "major", value: "major" },
    ],
  });
  return response.value;
}

async function promptForContent(): Promise<string> {
  const response = await prompts({
    type: "text",
    name: "value",
    instructions: false,
    message: "Enter a summary for the change",
  });
  return response.value;
}
