import pc from "picocolors";
import { BasicReporter } from "./basic.js";
import type { Reporter, Task, TaskStatus } from "./types.js";
import { createSpinner } from "./utils.js";

export class DynamicReporter extends BasicReporter implements Reporter {
  async task(message: string, action: (task: Task) => Promise<TaskStatus | void>) {
    if (!this.isTTY) {
      return super.task(message, action);
    }

    let current = message;
    const task = {
      update: (newMessage: string) => {
        current = newMessage;
      },
    };

    const spinner = createSpinner();
    const interval = setInterval(() => {
      this.#printProgress(`\r${pc.yellow(spinner())} ${current}`);
    }, 300);
    const status = await action(task);
    clearInterval(interval);
    this.#printProgress(`\r${this.getStatusChar(status)} ${current}\n`);
  }

  #printProgress(content: string) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(content);
  }
}
