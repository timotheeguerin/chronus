import pc from "picocolors";
import prompts from "prompts";
import type { ChangeStatus } from "../../change/find.js";
import { findChangeStatus } from "../../change/index.js";
import { writeChangeDescription } from "../../change/write.js";
import type { ChangeKindResolvedConfig, ChronusResolvedConfig } from "../../config/types.js";
import { createGitSourceControl } from "../../source-control/git.js";
import { NodeChronusHost } from "../../utils/node-host.js";
import type { Package } from "../../workspace-manager/types.js";
import { loadChronusWorkspace } from "../../workspace/load.js";

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

export interface AddChangesetOptions {
  readonly cwd: string;
  readonly since?: string;
}

export async function addChangeset({ cwd, since }: AddChangesetOptions): Promise<void> {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, cwd);
  const sourceControl = createGitSourceControl(workspace.path);
  const status = await findChangeStatus(host, sourceControl, workspace, { since });
  if (status.committed.packageChanged.length === 0) {
    log("No package changed. Exiting.\n");
    return;
  }
  const packageToInclude = await promptForPackages(status);

  if (packageToInclude === undefined || packageToInclude.length === 0) {
    log("No package selected. Exiting.\n");
    return;
  }
  const changeKind = await promptChangeKind(workspace.config);
  if (changeKind === undefined) {
    log("No change kind selected, cancelling.");
    return;
  }
  const changesetContent = await promptForContent();
  if (changesetContent === undefined) {
    log("No change content, cancelling.");
    return;
  }
  const result = await writeChangeDescription(host, workspace, {
    id: getChangesetId(await sourceControl.getCurrentBranch()),
    content: changesetContent,
    packages: packageToInclude.map((x) => x.name),
    changeKind,
  });
  log("Wrote change", pc.cyan(result));
}

async function promptForPackages(status: ChangeStatus): Promise<Package[] | undefined> {
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
        selected: true,
      })),
      ...documentedPackages.map((x) => ({
        title: `${x.name} ${pc.green("(Already documented)")}`,
        value: x,
      })),
    ],
  });
  return response.value;
}

async function promptChangeKind(config: ChronusResolvedConfig): Promise<ChangeKindResolvedConfig | undefined> {
  const choices: prompts.Choice[] = Object.entries(config.changeKinds).map(([key, value]) => {
    return { title: value.title ?? key, value };
  });
  const response = await prompts({
    type: "select",
    name: "value",
    instructions: false,
    message: "Describe the type of change",
    choices,
  });
  return response.value;
}

async function promptForContent(): Promise<string | undefined> {
  const response = await prompts({
    type: "text",
    name: "value",
    instructions: false,
    message: "Enter a summary for the change",
  });
  return response.value;
}

function getChangesetId(branchName: string): string {
  const date = new Date();
  return [
    branchName.replace(/\//g, "-"),
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ].join("-");
}
