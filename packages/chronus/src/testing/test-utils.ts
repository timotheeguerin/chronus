import { ok } from "assert";

/**
 * Takes source code with a cursor position indicated by the given marker
 * ("┆" by default), and returns the source without the marker along with
 * the cursor position.
 */
export function extractCursor(sourceWithCursor: string, marker = "┆"): { source: string; pos: number } {
  const pos = sourceWithCursor.indexOf(marker);
  ok(pos >= 0, "marker not found");
  const source = sourceWithCursor.replace(marker, "");
  return { source, pos };
}
