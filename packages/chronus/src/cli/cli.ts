import "source-map-support/register.js";
import yargs from "yargs";
import { addChangeset } from "./commands/add-changeset.js";
import { applyChangesets } from "./commands/apply-changesets.js";
import { listPendingPublish } from "./commands/list-pending-publish.js";
import { showStatus } from "./commands/show-status.js";
import { verifyChangeset } from "./commands/verify-changeset.js";

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
    .command("add", "Add a new change description", () => addChangeset(process.cwd()))
    .command("verify", "Verify all packages changes have been documented", () => verifyChangeset(process.cwd()))
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
      (args) => applyChangesets(process.cwd(), { ignorePolicies: args.ignorePolicies, only: args.only }),
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
      (args) => showStatus(process.cwd(), { ignorePolicies: args.ignorePolicies, only: args.only }),
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
    .demandCommand(1, "You need at least one command before moving on")
    .parse();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.log("Error", error);
  process.exit(1);
});

process.on("SIGTERM", () => process.exit(2));
process.on("SIGINT", () => process.exit(2));
process.on("SIGUSR1", () => process.exit(2));
process.on("SIGUSR2", () => process.exit(2));
