import { getDirectoryPath } from "@chronus/chronus/utils";
import { mkdir, writeFile } from "fs/promises";
import { getPullRequestContext } from "../../pull-requests/context/index.js";
import { resolveChangeStatusCommentForPr } from "../../pull-requests/index.js";

export interface GetPRCommentArgs {
  readonly out?: string;
}

export async function getPrComment(args: GetPRCommentArgs) {
  const context = getPullRequestContext();
  const comment = await resolveChangeStatusCommentForPr(context);

  const raw = JSON.stringify(comment, null, 2);
  if (args.out === undefined) {
    log(raw);
  } else {
    log("Writing comment to file: " + args.out);
    await mkdir(getDirectoryPath(args.out), { recursive: true });
    await writeFile(args.out, raw);
  }
}

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(message);
}
