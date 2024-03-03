import type { ChangelogGeneratorFactory } from "./types.js";

export function defineChangelogGenerator<T>(fn: ChangelogGeneratorFactory<T>): ChangelogGeneratorFactory<T> {
  return fn;
}
