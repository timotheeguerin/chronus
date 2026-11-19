import type { ChangeStatus, ChronusWorkspace } from "@chronus/chronus";
import { getChangesetRequirementExemption } from "@chronus/chronus/change";
import { createTestChronusWorkspace } from "@chronus/chronus/testing";
import { expect, it } from "vitest";

import { getChangeStatusComment } from "./comment.js";
import type { PullRequestContext } from "./context/types.js";

const context: Required<PullRequestContext> = {
  repo: { owner: "owner", name: "repo" },
  prNumber: 123,
  headRef: "feature",
  prTitle: "[skip chg] Update CI",
};
const pr = { head: { repo: { html_url: "https://github.com/owner/repo" } } };

function undocumentedStatus(workspace: ChronusWorkspace): ChangeStatus {
  const pkg = workspace.getPackage("pkg-a");
  const area = {
    changeDescriptions: [],
    filesChanged: ["packages/pkg-a/index.ts"],
    packageChanged: [pkg],
    packagesDocumented: [],
  };
  return {
    packages: new Map([[pkg.name, { package: pkg, changed: "committed" }]]),
    committed: area,
    staged: area,
    untrackedOrModified: area,
    all: area,
  };
}

it("explains a configured exemption instead of requesting a changeset", async () => {
  const workspace = createTestChronusWorkspace({
    packages: { "pkg-a": {} },
    config: { verify: { changesetRequirement: { excludeTitleContains: ["[skip chg]"] } } },
  });
  const exemption = await getChangesetRequirementExemption(workspace, context);
  const content = getChangeStatusComment(workspace, undocumentedStatus(workspace), pr, context, exemption);
  expect(content).toContain("No new changeset is required: PR title contains '[skip chg]'.");
  expect(content).not.toContain(":x:");
  expect(content).not.toContain("chronus add");
});

it("does not treat a skip marker as an exemption unless the repository configures it", async () => {
  const workspace = createTestChronusWorkspace({ packages: { "pkg-a": {} } });
  const exemption = await getChangesetRequirementExemption(workspace, context);
  const content = getChangeStatusComment(workspace, undocumentedStatus(workspace), pr, context, exemption);
  expect(content).toContain("chronus add");
  expect(content).toContain("pkg-a");
  expect(content).not.toContain("No new changeset is required");
});
