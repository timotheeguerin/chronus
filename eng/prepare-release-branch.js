// @ts-check
import { getOctokit } from "@actions/github";
import { execSync } from "child_process";
import { showStatusAsMarkdown } from "../packages/chronus/dist/cli/commands/show-status.js";
const branchName = "publish/auto-release";

const changeStatus = await showStatusAsMarkdown(process.cwd());
execSync(`pnpm change version`);
const stdout = execSync(`git status --porcelain`).toString();

if (stdout.trim() !== "") {
  console.log("Commiting the following changes:\n", stdout);

  execSync(`git -c user.email=chronus@github.com -c user.name="Auto Chronus Bot" commit -am "Bump versions"`);
  execSync(`git push origin HEAD:${branchName} --force`);

  console.log();
  console.log("-".repeat(160));
  console.log("|  Link to create the PR");
  console.log(`|  https://github.com/timotheeguerin/chronus/pull/new/${branchName}  `);
  console.log("-".repeat(160));

  const github = getOctokit(process.env.GITHUB_TOKEN ?? "");
  const prs = github.rest.pulls.list({
    owner: "timotheeguerin",
    repo: "chronus",
    head: branchName,
    base: "main",
    state: "open",
  });
  const existing = prs[0];
  if (existing) {
    await github.rest.pulls.update({
      // cspell:ignore timotheeguerin
      owner: "timotheeguerin",
      repo: "chronus",
      pull_number: existing.number,
      body: changeStatus,
    });
  } else {
    await github.rest.pulls.create({
      // cspell:ignore timotheeguerin
      owner: "timotheeguerin",
      repo: "chronus",
      title: "Release changes",
      head: branchName,
      base: "main",
      body: changeStatus,
    });
  }
} else {
  console.log("No changes to publish");
}
