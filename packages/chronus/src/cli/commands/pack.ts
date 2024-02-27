import pc from "picocolors";
import { NodeChronusHost, loadChronusWorkspace } from "../../index.js";
import { packPackage } from "../../pack/index.js";
import { DynamicReporter } from "../../reporters/dynamic.js";

export interface PackOptions {
  /** Directory that should contain the generated `.tgz` */
  readonly packDestination?: string;
}
export async function pack(dir: string, options: PackOptions) {
  const reporter = new DynamicReporter();
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, dir);
  for (const pkg of workspace.packages) {
    await reporter.task(`${pc.yellow(pkg.name)} packing...`, async (task) => {
      const result = await packPackage(workspace, pkg, options.packDestination);
      task.update(`${pc.yellow(pkg.name)} packed in ${pc.cyan(result.filename)}.`);
    });
  }
}
