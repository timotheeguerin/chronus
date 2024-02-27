import pc from "picocolors";
import { isCI } from "std-env";
import type { Task } from "./types.js";

export class BasicReporter {
  isTTY = process.stdout?.isTTY && !isCI;

  log(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }

  async task(message: string, action: (task: Task) => Promise<void>) {
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
}
