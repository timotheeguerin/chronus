import type { ChronusWorkspace } from "@chronus/chronus";
import { resolvePath, type ChronusHost } from "@chronus/chronus/utils";

const versionHeadingRegex = /^## (\d\.\d\.\d[^ ]*)$/;

export async function loadChangelogForVersion(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  packageName: string,
  version: string,
) {
  const packageChangelog = await loadPackageChangelog(host, workspace, packageName);
  if (packageChangelog === undefined) {
    return undefined;
  }

  return extractVersionChangelog(packageChangelog, version);
}

export function extractVersionChangelog(changelog: string, version: string): string | undefined {
  const lines = changelog.split("\n");
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = versionHeadingRegex.exec(line);
    if (match) {
      if (match[1] === version && start === -1) {
        start = i + 1;
      } else if (start !== -1) {
        return lines.slice(start, i).join("\n");
      }
    }
  }
  if (start !== -1) {
    return lines.slice(start).join("\n");
  } else {
    return undefined;
  }
}

async function loadPackageChangelog(host: ChronusHost, workspace: ChronusWorkspace, packageName: string) {
  const pkg = workspace.getPackage(packageName);
  const changelogFile = resolvePath(workspace.path, pkg.relativePath, "CHANGELOG.md");

  try {
    const file = await host.readFile(changelogFile);
    return file.content;
  } catch {
    return undefined;
  }
}
