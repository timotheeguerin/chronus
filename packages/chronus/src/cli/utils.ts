import { ZodError } from "zod";
import { DynamicReporter } from "../reporters/dynamic.js";
import type { Reporter } from "../reporters/types.js";

function withReporter<T>(fn: (reporter: T & { reporter: Reporter }) => Promise<void>): (args: T) => Promise<void> {
  return (args: T) => {
    const reporter = new DynamicReporter();
    return fn({ reporter, ...args });
  };
}

export function withErrors<T>(fn: (args: T) => Promise<void>): (args: T) => Promise<void> {
  return async (args: T) => {
    try {
      await fn(args);
    } catch (error) {
      logError(error);
      process.exit(1);
    }
  };
}

export function withErrorsAndReporter<T>(
  fn: (reporter: T & { reporter: Reporter }) => Promise<void>,
): (args: T) => Promise<void> {
  return withErrors(withReporter(fn));
}

function logError(error: unknown) {
  /* eslint-disable no-console */
  if (error instanceof ZodError) {
    console.error(error.flatten());
  } else {
    console.error(error);
  }
  /* eslint-enable no-console */
}
