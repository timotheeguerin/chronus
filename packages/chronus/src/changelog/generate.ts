import type { ChangeDescription } from "../change/types.js";
import type { ChronusWorkspace } from "../index.js";
import type { ReleaseAction } from "../release-plan/types.js";
import { ChronusError } from "../utils/errors.js";
import type { ChronusHost } from "../utils/host.js";
import { resolvePath } from "../utils/path-utils.js";
import type { ChronusPackage } from "../workspace/types.js";
import { BasicChangelogGenerator } from "./basic.js";
import type { ChangelogGenerator } from "./types.js";

export async function resolveChangelogGenerator(
  workspace: ChronusWorkspace,
  changes: ChangeDescription[],
): Promise<ChangelogGenerator> {
  const generatorConfig = workspace.config.changelog
    ? typeof workspace.config.changelog === "string"
      ? { name: workspace.config.changelog, options: undefined }
      : { name: workspace.config.changelog[0], options: workspace.config.changelog[1] }
    : { name: "basic", options: undefined };

  switch (generatorConfig.name) {
    case "basic":
      return loadBasicChangelogGenerator(workspace);
    default:
      return loadChangelogGenerator(workspace, generatorConfig, changes);
  }
}

function loadBasicChangelogGenerator(workspace: ChronusWorkspace): ChangelogGenerator {
  const generator = new BasicChangelogGenerator(workspace);
  return {
    renderPackageVersion: (newVersion, changes) => generator.renderPackageVersion(newVersion, changes),
  };
}

async function loadChangelogGenerator(
  workspace: ChronusWorkspace,
  {
    name,
    options,
  }: {
    name: string;
    options: Record<string, unknown> | undefined;
  },
  changes: ChangeDescription[],
) {
  const data = await import(name);
  if (data.default === undefined) {
    throw new ChronusError(`Changelog generator "${name}" doesn't have a default export.`);
  }
  if (typeof data.default !== "function") {
    throw new ChronusError(`Changelog generator "${name}" default export should be a function`);
  }

  const generator: ChangelogGenerator = data.default(workspace, options);
  if (generator.loadData) {
    await generator.loadData(changes);
  }
  return generator;
}

export async function updateChangelog(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  generator: ChangelogGenerator,
  action: ReleaseAction,
): Promise<void> {
  const newEntry = generator.renderPackageVersion(action.newVersion, action.changes);
  const wrapped = `\n\n${newEntry}\n`;

  const pkg = workspace.getPackage(action.packageName);
  const changelogPath = resolvePath(workspace.path, pkg.relativePath, "CHANGELOG.md");
  const existingContent = await getExistingChangelog(host, changelogPath);

  const newContent = existingContent ? prependChangelogEntry(existingContent, wrapped) : newChangelog(pkg, wrapped);
  await host.writeFile(changelogPath, newContent);
}

function prependChangelogEntry(existingContent: string, newEntry: string): string {
  return existingContent.replace("\n", newEntry);
}
function newChangelog(pkg: ChronusPackage, newEntry: string): string {
  return `# Changelog - ${pkg.name}\n\n${newEntry}`;
}

async function getExistingChangelog(host: ChronusHost, filename: string): Promise<string | undefined> {
  try {
    return (await host.readFile(filename)).content;
  } catch {
    return undefined;
  }
}
