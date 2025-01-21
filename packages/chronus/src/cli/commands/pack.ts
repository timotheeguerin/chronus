import pc from "picocolors";
import { NodeChronusHost, loadChronusWorkspace } from "../../index.js";
import { packPackage } from "../../pack/index.js";
import type { Reporter } from "../../reporters/index.js";
import { isPackageIncluded, prettyBytes } from "../../utils/misc-utils.js";

export interface PackOptions {
  readonly reporter: Reporter;

  readonly dir: string;

  /** Directory that should contain the generated `.tgz` */
  readonly packDestination?: string;

  readonly only?: string[];
  readonly exclude?: string[];
}

export async function pack({ reporter, dir, packDestination, only, exclude }: PackOptions) {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, dir);
  for (const pkg of workspace.packages) {
    if (!isPackageIncluded(pkg.name, { only, exclude })) {
      continue;
    }
    await reporter.task(`${pc.yellow(pkg.name)} packing`, async (task) => {
      const result = await packPackage(workspace, pkg, packDestination);
      task.update(
        `${pc.yellow(pkg.name)} packed in ${pc.cyan(result.filename)} (${pc.magenta(prettyBytes(result.size))})`,
      );
    });
  }
}
