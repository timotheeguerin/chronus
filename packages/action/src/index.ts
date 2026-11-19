import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import {
  NodeChronusHost,
  renderReleasePlanAsMarkdown,
  resolveCurrentReleasePlan,
  type ReleasePlan,
} from "@chronus/chronus";

interface ActionInputs {
  readonly versionCommand: string;
  readonly cwd: string;
  readonly commitMessage: string;
  readonly prTitle: string;
  readonly prBody: string | undefined;
  readonly branch: string;
  readonly base: string;
  readonly token: string;
}

const gitUserName = "Chronus Bot";
const gitUserEmail = "chronus@github.com";

function getInputs(): ActionInputs {
  const defaultBranch = (github.context.payload.repository as { default_branch?: string } | undefined)?.default_branch;
  return {
    versionCommand: core.getInput("version") || "npx chronus version",
    cwd: core.getInput("cwd") || process.cwd(),
    commitMessage: core.getInput("commit-message") || "Bump versions",
    prTitle: core.getInput("pr-title") || "Release changes",
    prBody: core.getInput("pr-body") || undefined,
    branch: core.getInput("branch") || "chronus/version-packages",
    base: core.getInput("base") || defaultBranch || "main",
    token: core.getInput("token") || process.env.GITHUB_TOKEN || "",
  };
}

async function git(args: string[], cwd: string): Promise<void> {
  await exec.exec("git", args, { cwd });
}

async function hasPendingWorkingTreeChanges(cwd: string): Promise<boolean> {
  const { stdout } = await exec.getExecOutput("git", ["status", "--porcelain"], { cwd, silent: true });
  return stdout.trim() !== "";
}

async function run(): Promise<void> {
  const inputs = getInputs();
  if (!inputs.token) {
    throw new Error("No GitHub token provided. Set the `token` input or the GITHUB_TOKEN environment variable.");
  }

  const plan = await resolveCurrentReleasePlan(NodeChronusHost, inputs.cwd);
  if (plan.actions.length === 0) {
    core.info("No pending changes found. Nothing to version.");
    core.setOutput("hasChangesets", false);
    return;
  }
  core.setOutput("hasChangesets", true);
  core.info(`Found ${plan.actions.length} package(s) to bump. Running version command.`);

  await exec.exec(inputs.versionCommand, undefined, { cwd: inputs.cwd });

  if (!(await hasPendingWorkingTreeChanges(inputs.cwd))) {
    core.info("Version command produced no file changes. Skipping PR creation.");
    return;
  }

  await commitAndPush(inputs);
  await createOrUpdatePullRequest(inputs, plan);
}

async function commitAndPush(inputs: ActionInputs): Promise<void> {
  const { cwd, branch, commitMessage } = inputs;
  await git(["config", "user.name", gitUserName], cwd);
  await git(["config", "user.email", gitUserEmail], cwd);
  await git(["add", "-A"], cwd);
  await git(["commit", "-m", commitMessage], cwd);
  await git(["push", "origin", `HEAD:refs/heads/${branch}`, "--force"], cwd);
}

async function createOrUpdatePullRequest(inputs: ActionInputs, plan: ReleasePlan): Promise<void> {
  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(inputs.token);
  const body = inputs.prBody ?? (await renderReleasePlanAsMarkdown(plan));

  const existing = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${inputs.branch}`,
    base: inputs.base,
    state: "open",
  });

  const existingPr = existing.data[0];
  if (existingPr) {
    core.info(`Updating existing pull request #${existingPr.number}.`);
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: existingPr.number,
      title: inputs.prTitle,
      body,
    });
    setPrOutputs(existingPr.number, inputs.branch);
  } else {
    core.info(`Creating draft pull request from ${inputs.branch} into ${inputs.base}.`);
    const created = await octokit.rest.pulls.create({
      owner,
      repo,
      head: inputs.branch,
      base: inputs.base,
      title: inputs.prTitle,
      body,
      // Draft works around orgs that block Actions from triggering workflows on non-draft PRs.
      draft: true,
    });
    setPrOutputs(created.data.number, inputs.branch);
  }
}

function setPrOutputs(prNumber: number, branch: string): void {
  core.setOutput("prNumber", prNumber);
  core.setOutput("prBranch", branch);
}

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
