import "source-map-support/register.js";
import yargs from "yargs";
import { addChangeset } from "./commands/add-changeset.js";
import { applyChangesets } from "./commands/apply-changesets.js";
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
    .command("add", "Add a new changeset", () => addChangeset(process.cwd()))
    .command("verify", "Verify all packages changes have been documented", () => verifyChangeset(process.cwd()))
    .command("version", "Apply change changeset and bump the versions", () => applyChangesets(process.cwd()))
    .command("status", "Display the status of changes. What will happen during the next release", () =>
      showStatus(process.cwd()),
    )
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
