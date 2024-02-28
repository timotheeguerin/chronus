import pc from "picocolors";
import { isCI } from "std-env";
import { F_CHECK, F_CROSS, F_DOT } from "../utils/figures.js";
import type { Reporter, Task, TaskStatus } from "./types.js";

export class BasicReporter implements Reporter {
  isTTY = process.stdout?.isTTY && !isCI;

  log(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }

  async task(message: string, action: (task: Task) => Promise<TaskStatus | void>) {
    let current = message;
    const task = {
      update: (newMessage: string) => {
        current = newMessage;
      },
    };
    this.log(`${pc.yellow("-")} ${current}`);
    await action(task);
    this.log(`${pc.green("✔")} ${current}`);
  }

  getStatusChar(status: TaskStatus | void | undefined) {
    switch (status) {
      case "failure":
        return pc.red(F_CROSS);

      case "skipped":
        return pc.gray(F_DOT);
      case "success":
      default:
        return pc.green(F_CHECK);
    }
  }
}
