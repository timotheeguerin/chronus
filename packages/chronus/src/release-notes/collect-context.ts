import { readChangeDescriptions } from "../change/read.js";
import { assembleReleasePlan } from "../release-plan/assemble-release-plan.js";
import type { ChronusHost } from "../utils/host.js";
import { loadChronusWorkspace } from "../workspace/index.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import type { ReleaseNotesChange, ReleaseNotesContext, ReleaseNotesContextEnricher } from "./types.js";

export interface CollectContextOptions {
  readonly dir: string;
  readonly package?: string | string[];
  readonly policy?: string | string[];
  readonly enrichers?: ReleaseNotesContextEnricher[];
}

/**
 * Collects all relevant change data and assembles it into a structured context
 * suitable for passing to an LLM prompt template.
 */
export async function collectReleaseNotesContext(
  host: ChronusHost,
  options: CollectContextOptions,
): Promise<ReleaseNotesContext> {
  const workspace = await loadChronusWorkspace(host, options.dir);
  const changes = await readChangeDescriptions(host, workspace);
  const plan = assembleReleasePlan(changes, workspace);

  const packages = normalizeArray(options.package);
  const policies = normalizeArray(options.policy);

  // Determine which packages are in scope
  const scopedPackages = resolveScopedPackages(workspace, packages, policies);

  // Filter changes to only those affecting scoped packages
  const relevantChanges = changes.filter((c) => c.packages.some((p) => scopedPackages.has(p)));

  // Build change entries grouped by kind
  const changesByKind: Record<string, ReleaseNotesChange[]> = {};
  for (const change of relevantChanges) {
    const kind = change.changeKind.name;
    const entry: ReleaseNotesChange = {
      id: change.id,
      content: change.content,
      packages: change.packages.filter((p) => scopedPackages.has(p)),
      changeKind: kind,
    };

    if (!changesByKind[kind]) {
      changesByKind[kind] = [];
    }
    changesByKind[kind].push(entry);
  }

  // Determine version from release plan (first matching action)
  const version = resolveVersion(plan, scopedPackages);

  // Apply enrichers
  let allChanges = Object.values(changesByKind).flat();
  for (const enricher of options.enrichers ?? []) {
    allChanges = await enricher.enrichChanges(allChanges, workspace);
  }

  // Re-group after enrichment (metadata may have been added)
  const enrichedByKind: Record<string, ReleaseNotesChange[]> = {};
  for (const change of allChanges) {
    if (!enrichedByKind[change.changeKind]) {
      enrichedByKind[change.changeKind] = [];
    }
    enrichedByKind[change.changeKind].push(change);
  }

  return {
    version,
    releaseDate: new Date().toISOString().split("T")[0],
    packages: [...scopedPackages],
    policy: policies.length === 1 ? policies[0] : undefined,
    changesByKind: enrichedByKind,
    enrichments: {},
  };
}

function resolveScopedPackages(workspace: ChronusWorkspace, packages: string[], policies: string[]): Set<string> {
  const result = new Set<string>();

  for (const pkgName of packages) {
    const pkg = workspace.allPackages.find((p) => p.name === pkgName);
    if (pkg) {
      result.add(pkg.name);
    }
  }

  for (const policyName of policies) {
    const policy = workspace.config.versionPolicies?.find((p) => p.name === policyName);
    if (policy) {
      for (const pkgName of policy.packages) {
        result.add(pkgName);
      }
    }
  }

  // If no filter specified, include all packages
  if (result.size === 0) {
    for (const pkg of workspace.packages) {
      result.add(pkg.name);
    }
  }

  return result;
}

function resolveVersion(
  plan: { actions: { packageName: string; newVersion: string }[] },
  scopedPackages: Set<string>,
): string | undefined {
  const action = plan.actions.find((a) => scopedPackages.has(a.packageName));
  return action?.newVersion;
}

function normalizeArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Render the context as a markdown document suitable for LLM consumption.
 * Preserves full change descriptions (including code blocks) and structures
 * data by kind and package for the AI to work with.
 */
export function renderContextAsMarkdown(context: ReleaseNotesContext): string {
  const lines: string[] = [];

  lines.push("# Release Notes Context");
  lines.push("");

  if (context.version) {
    lines.push(`**Version:** ${context.version}`);
  }
  if (context.releaseDate) {
    lines.push(`**Release Date:** ${context.releaseDate}`);
  }
  if (context.policy) {
    lines.push(`**Policy:** ${context.policy}`);
  }
  lines.push(`**Packages:** ${context.packages.join(", ")}`);
  lines.push("");

  lines.push("## Changes");
  lines.push("");

  for (const [kind, changes] of Object.entries(context.changesByKind)) {
    lines.push(`### ${kind}`);
    lines.push("");

    // Group by package within each kind
    const byPackage = new Map<string, ReleaseNotesChange[]>();
    for (const change of changes) {
      const pkgKey = change.packages.join(", ") || "(unscoped)";
      const existing = byPackage.get(pkgKey);
      if (existing) {
        existing.push(change);
      } else {
        byPackage.set(pkgKey, [change]);
      }
    }

    for (const [pkg, pkgChanges] of byPackage) {
      lines.push(`#### ${pkg}`);
      lines.push("");
      for (const change of pkgChanges) {
        // Render the full content preserving code blocks
        const content = change.content.trim();
        const prLink = renderPrLink(change.metadata);

        if (content.includes("\n")) {
          // Multi-line content (has code blocks or paragraphs)
          lines.push(`- ${prLink}${content}`);
        } else {
          lines.push(`- ${prLink}${content}`);
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function renderPrLink(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return "";
  const prNumber = metadata["prNumber"];
  const prUrl = metadata["prUrl"];
  if (typeof prNumber === "number" && typeof prUrl === "string") {
    return `[#${prNumber}](${prUrl}) `;
  }
  return "";
}

/**
 * Render the context as a JSON document.
 */
export function renderContextAsJson(context: ReleaseNotesContext): string {
  return JSON.stringify(context, null, 2);
}
