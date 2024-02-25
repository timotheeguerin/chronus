import pc from "picocolors";
import { findUnpublishedPackages } from "../../unpublished-packages/find-unpublished-packages.js";
import { NodeChronusHost } from "../../utils/node-host.js";
import { loadChronusWorkspace } from "../../workspace/index.js";

export interface ListPendingPublishOptions {
  readonly json?: boolean;
}

export async function listPendingPublish(dir: string, options?: ListPendingPublishOptions) {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, dir);

  const packages = await findUnpublishedPackages(workspace);
  if (options?.json) {
    log(JSON.stringify(packages, null, 2));
  } else {
    log("Packages with unpublished versions:");
    for (const pkg of packages) {
      log(`- ${pkg.name} ${pc.cyan(pkg.version)}`);
    }
    log();
  }
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
