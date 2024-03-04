import type { ChronusHost } from "../utils/host.js";
import type { PublishSummary } from "./types.js";

export async function readPublishSummary(host: ChronusHost, path: string): Promise<PublishSummary> {
  const file = await host.readFile(path);
  return JSON.parse(file.content);
}
