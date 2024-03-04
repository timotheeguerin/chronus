import { resolvePath } from "@chronus/chronus/utils";
import "source-map-support/register.js";
import yargs from "yargs";
import { createRelease } from "./actions/create-release.js";

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
      "create-releases",
      "Create github releases from publish report",
      (cmd) =>
        cmd
          .option("publish-summary", {
            type: "string",
            description: "Path to the report summary",
          })
          .option("repo", {
            type: "string",
            description: "Github repository",
          })
          .demandOption("publish-summary")
          .demandOption("repo"),
      (args) =>
        createRelease({
          publishSummary: resolveCliPath(args.publishSummary),
          repo: args.repo,
          workspaceDir: process.cwd(),
        }),
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
