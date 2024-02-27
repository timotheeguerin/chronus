import pc from "picocolors";
import { NodeChronusHost, loadChronusWorkspace } from "../../index.js";
import { packPackage } from "../../pack/index.js";
export interface PackOptions {
  /** Directory that should contain the generated `.tgz` */
  readonly packDestination?: string;
}
export async function pack(dir: string, options: PackOptions) {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, dir);
  for (const pkg of workspace.packages) {
    log(`${pc.yellow("-")} Packing ${pkg.name}...`);
    const result = await packPackage(workspace, pkg, options.packDestination);
    log(`${pc.green("✔")} ${pkg.name} packed in ${result.filename}.`);
  }
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
