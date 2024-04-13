import "source-map-support/register.js";
import yargs from "yargs";
import { resolvePath } from "../utils/path-utils.js";
import { addChangeset } from "./commands/add-changeset.js";
import { applyChangesets } from "./commands/apply-changesets.js";
import { changelog } from "./commands/changelog.js";
import { listPendingPublish } from "./commands/list-pending-publish.js";
import { pack } from "./commands/pack.js";
import { publish } from "./commands/publish.js";
import { showStatus } from "./commands/show-status.js";
import { verifyChangeset } from "./commands/verify-changeset.js";
import { withErrors, withErrorsAndReporter } from "./utils.js";

export const DEFAULT_PORT = 3000;

async function main() {
  await yargs(process.argv.slice(2))
    .scriptName("chronus")
    .strict()
    .help()
    .parserConfiguration({
      "greedy-arrays": false,
      "boolean-negation": false,
    })
    .option("debug", {
      type: "boolean",
      description: "Output debug log messages.",
      default: false,
    })
    .command(
      "add",
      "Add a new change description",
      (cmd) =>
        cmd.option("since", {
          type: "string",
          description:
            "Verify since the the given branch. Default to the baseBranch configured in .chronus/config.yaml",
        }),
      withErrors((args) => addChangeset({ cwd: process.cwd(), since: args.since })),
    )
    .command(
      "verify",
      "Verify all packages changes have been documented",
      (cmd) =>
        cmd.option("since", {
          type: "string",
          description:
            "Verify since the the given branch. Default to the baseBranch configured in .chronus/config.yaml",
        }),
      withErrors((args) => verifyChangeset({ cwd: process.cwd(), since: args.since })),
    )
    .command(
      "version",
      "Apply change changeset and bump the versions",
      (cmd) =>
        cmd
          .option("ignore-policies", {
            type: "boolean",
            description: "Ignore versioning policies and bump each package independently",
            default: false,
          })
          .option("only", {
            type: "string",
            array: true,
            description: "Only bump the specified package(s)",
          }),
      withErrors((args) => applyChangesets(process.cwd(), { ignorePolicies: args.ignorePolicies, only: args.only })),
    )
    .command(
      "status",
      "Display the status of changes. What will happen during the next release",
      (cmd) =>
        cmd
          .option("ignore-policies", {
            type: "boolean",
            description: "Ignore versioning policies and bump each package independently",
            default: false,
          })
          .option("only", {
            type: "string",
            array: true,
            description: "Only bump the specified package(s)",
          }),
      withErrors((args) => showStatus(process.cwd(), { ignorePolicies: args.ignorePolicies, only: args.only })),
    )
    .command(
      ["ls-pending-publish", "list-pending-publish"],
      "Find packages that have not been published",
      (cmd) =>
        cmd.option("json", {
          type: "boolean",
          description: "Render the output as JSON",
          default: false,
        }),
      (args) => listPendingPublish(process.cwd(), { json: args.json }),
    )
    .command(
      "changelog",
      "Generate change logs for the current change descriptions",
      (cmd) =>
        cmd
          .option("package", {
            type: "string",
            description: "Generate a change log for a specific package",
          })
          .option("policy", {
            type: "string",
            description: "Generate a change log for a specific policy",
          }),
      withErrorsAndReporter((args) =>
        changelog({
          reporter: args.reporter,
          dir: process.cwd(),
          package: args.package,
          policy: args.policy,
        }),
      ),
    )
    .command(
      ["pack"],
      "Pack all packages that can be published",
      (cmd) =>
        cmd.option("pack-destination", {
          type: "string",
          description: "Containing directory for the packed packages. Default to each package own directory.",
        }),
      withErrorsAndReporter((args) =>
        pack({
          reporter: args.reporter,
          dir: process.cwd(),
          packDestination: args.packDestination && resolveCliPath(args.packDestination),
        }),
      ),
    )
    .command(
      ["publish [include]"],
      "Publish all the packages that can be published. If a package is already published at the same version, it will be skipped.",
      (cmd) =>
        cmd
          .positional("include", {
            type: "string",
            description:
              "Pattern of package to publish. This can be pointing to tarball, folder(with package.json or workspace root) to publish. Default to publishing package in the workspace.",
          })
          .option("access", {
            type: "string",
            choices: ["public", "restricted"] as const,
            description: "Tells the registry whether this package should be published as public or restricted",
          })
          .option("registry", {
            type: "string",
            description: "Npm registry to use for publishing",
          })
          .option("engine", {
            type: "string",
            choices: ["npm", "pnpm"] as const,
            description: "Engine to use (npm or pnpm, default to use pnpm in a pnpm workspace and npm otherwise)",
          })
          .option("tag", {
            type: "string",
            description: "Npm dist-tag to use when publishing the package.",
          })
          .option("report-summary", {
            type: "string",
            description: "Save the list of published packages.",
          }),
      withErrorsAndReporter((args) =>
        publish({
          reporter: args.reporter,
          pattern: args.include ? resolvePath(process.cwd(), args.include) : process.cwd(),
          access: args.access,
          registry: args.registry,
          engine: args.engine,
          reportSummary: args.reportSummary && resolvePath(process.cwd(), args.reportSummary),
        }),
      ),
    )
    .demandCommand(1, "You need at least one command before moving on")
    .parse();
}

function resolveCliPath(path: string) {
  return resolvePath(process.cwd(), path);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.log("Error", error);
  process.exit(1);
});

process.on("unhandledRejection", (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection!", error);
  process.exit(1);
});

process.on("SIGTERM", () => process.exit(2));
process.on("SIGINT", () => process.exit(2));
process.on("SIGUSR1", () => process.exit(2));
process.on("SIGUSR2", () => process.exit(2));
