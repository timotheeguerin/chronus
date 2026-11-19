import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* eslint-disable no-console */

// Release the bundled GitHub Action the way changesets/action does: the built `dist/` is
// gitignored on the source branch and only force-committed onto the release refs consumers use.
// This creates a detached commit that includes packages/action/dist and pushes it to:
//   - an exact version tag:       action-v<version>
//   - a moving major-line branch: action-v<major>   (e.g. action-v1)
// Consumers then reference: timotheeguerin/chronus/packages/action@action-v1

const actionDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(actionDir, "..", "..");
const pkg = JSON.parse(readFileSync(resolve(actionDir, "package.json"), "utf8"));

const version: string = pkg.version;
const major = version.split(".")[0];
const exactTag = `action-v${version}`;
const majorBranch = `action-v${major}`;
const isPrerelease = version.includes("-");

const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("GITHUB_TOKEN is required");
}

// Authenticate the push without relying on the checkout's persisted credentials so this works
// regardless of the token used to check out the repository.
const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
const gitEnv = {
  ...process.env,
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
  GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
};

function git(args: string[], env?: NodeJS.ProcessEnv): void {
  execFileSync("git", args, { cwd: repoRoot, stdio: "inherit", env });
}

console.log(`Releasing @chronus/action as ${exactTag} (branch ${majorBranch})`);

git(["checkout", "--detach"]);
git(["add", "--force", "packages/action/dist"]);
git(["-c", "user.email=chronus@github.com", "-c", "user.name=Chronus Bot", "commit", "-m", exactTag]);
git(["tag", "-a", exactTag, "-m", exactTag]);

git(["push", "origin", `refs/tags/${exactTag}`], gitEnv);
if (!isPrerelease) {
  git(["push", "--force", "origin", `HEAD:refs/heads/${majorBranch}`], gitEnv);
}

console.log("Done");
