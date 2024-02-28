import pc from "picocolors";
import { publishPackage } from "../../publish/publish-package.js";
import type { Reporter } from "../../reporters/index.js";
import { findUnpublishedPackages } from "../../unpublished-packages/index.js";
import { NodeChronusHost } from "../../utils/index.js";
import { loadChronusWorkspace } from "../../workspace/index.js";

export interface PublishOptions {
  readonly reporter: Reporter;
  readonly dir: string;
  readonly otp?: string;
  readonly access?: string;
}

export async function publish({ reporter, dir, access, otp }: PublishOptions) {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, dir);
  const packageToPublish = await findUnpublishedPackages(workspace);
  for (const pkg of packageToPublish) {
    await reporter.task(`${pc.yellow(pkg.name)} publishing`, async (task) => {
      const result = await publishPackage(workspace, pkg, { access, otp });
      if (result.published) {
        task.update(`${pc.yellow(pkg.name)} published at version ${pc.cyan(pkg.version)}`);
        return "success";
      } else {
        return "failure";
      }
    });
  }
}
