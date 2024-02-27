import pc from "picocolors";
import { BasicReporter } from "./basic.js";
import type { Task } from "./types.js";
import { createSpinner } from "./utils.js";

export class DynamicReporter extends BasicReporter {
  async task(message: string, action: (task: Task) => Promise<void>) {
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
    await action(task);
    clearInterval(interval);
    this.#printProgress(`\r${pc.green("✔")} ${current}\n`);
  }

  #printProgress(content: string) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(content);
  }
}
