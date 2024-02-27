import pc from "picocolors";
import { publishPackage } from "../../publish/publish-package.js";
import type { Reporter } from "../../reporters/index.js";
import { NodeChronusHost } from "../../utils/index.js";
import { loadChronusWorkspace } from "../../workspace/index.js";

export interface PublishOptions {
  readonly reporter: Reporter;
  readonly dir: string;
  readonly opt?: string;
}

export async function publish({ reporter, dir, otp }: PublishOptions) {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, dir);
  for (const pkg of workspace.packages) {
    await reporter.task(`${pc.yellow(pkg.name)} packing`, async (task) => {
      const result = await publishPackage(workspace, pkg, { otp });
    });
  }
}
