// @ts-check
import { execFileSync, execSync } from "child_process";

const branchName = "publish/auto-release";

const changeStatus = execSync(`pnpm change status`).toString();
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
  execFileSync("gh", [
    "pr",
    "create",
    "-B",
    "publish/auto-release",
    "-H",
    "--title='Release PR'",
    "--body",
    changeStatus,
  ]).toString();
} else {
  console.log("No changes to publish");
}
