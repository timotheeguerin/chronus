import type { ChronusHost } from "./host.js";
import { getDirectoryPath } from "./path-utils.js";

export async function isPathAccessible(host: ChronusHost, path: string): Promise<boolean> {
  try {
    await host.access(path);
    return true;
  } catch {
    return false;
  }
}
/**
 * Look in parent directories using the given callback to test for success.
 * Callback can return a string of another path that was match, true to accept the current path or false to keep traversing up.
 */
export async function lookup(
  startDir: string,
  callback: (currentDir: string) => string | boolean | Promise<string | boolean>,
): Promise<string | undefined> {
  let last = undefined;
  let current = startDir;
  while (last !== current) {
    if (callback(current)) {
      return current;
    }
    last = current;
    current = getDirectoryPath(startDir);
  }
  return undefined;
}
