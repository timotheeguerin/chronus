import { writeFile } from "fs/promises";
import { getPullRequestContext } from "../../pull-requests/context/index.js";
import { resolveChangeStatusCommentForPr } from "../../pull-requests/index.js";

export interface GetPRCommentArgs {
  readonly out?: string;
}

export async function getPrComment(args: GetPRCommentArgs) {
  const context = getPullRequestContext();
  const content = await resolveChangeStatusCommentForPr(context);

  if (args.out === undefined) {
    log(content);
  } else {
    log("Writing comment to file: " + args.out);
    await writeFile(args.out, content);
  }
}

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(message);
}
