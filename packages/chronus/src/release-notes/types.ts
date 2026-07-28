import type { ChronusWorkspace } from "../workspace/types.js";

/**
 * Structured context for generating AI-powered release notes.
 * This is the data passed to a prompt template or output as context for an LLM.
 */
export interface ReleaseNotesContext {
  /** Version being released (if known) */
  readonly version?: string;
  /** Release date */
  readonly releaseDate?: string;
  /** Package names involved in this release */
  readonly packages: string[];
  /** Policy name (if scoped to a policy) */
  readonly policy?: string;
  /** All changes grouped by kind */
  readonly changesByKind: Record<string, ReleaseNotesChange[]>;
  /** Extra context provided by enricher plugins (e.g., PR info, authors) */
  readonly enrichments: Record<string, unknown>;
}

export interface ReleaseNotesChange {
  readonly id: string;
  readonly content: string;
  readonly packages: string[];
  readonly changeKind: string;
  /** Extra metadata from enrichers (PR number, author, etc.) */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Plugin interface for enriching release notes context with additional data.
 * For example, @chronus/github can add PR titles, authors, linked issues.
 */
export interface ReleaseNotesContextEnricher {
  readonly name: string;
  /** Enrich change entries with additional metadata */
  enrichChanges(changes: ReleaseNotesChange[], workspace: ChronusWorkspace): Promise<ReleaseNotesChange[]>;
}

export type ReleaseNotesContextEnricherFactory = (
  options: Record<string, unknown> | undefined,
) => ReleaseNotesContextEnricher | Promise<ReleaseNotesContextEnricher>;

/**
 * AI CLI that can generate the release notes from the rendered prompt.
 * `none` means only print the prompt.
 */
export type ReleaseNotesTool = "copilot" | "claude" | "none";

/**
 * Configuration for the release notes feature in .chronus/config.yaml
 */
export interface ReleaseNotesConfig {
  /** Path to a custom prompt template file (relative to workspace root) */
  readonly prompt?: string;
  /**
   * Path to write the generated release notes to (relative to workspace root).
   * Supports the `{{version}}` and `{{slug}}` placeholders, e.g. `release-notes/{{slug}}.md`.
   * The `--output` CLI flag takes precedence over this.
   */
  readonly output?: string;
  /** List of enricher module names */
  readonly enrichers?: (string | [string, Record<string, unknown>])[];
  /** AI tool to invoke (copilot, claude, or none) */
  readonly tool?: ReleaseNotesTool;
}

/**
 * Options for the release-notes CLI command
 */
export interface ReleaseNotesOptions {
  readonly dir: string;
  readonly package?: string | string[];
  readonly policy?: string | string[];
  readonly output?: string;
  readonly format?: "markdown" | "json";
  readonly tool?: ReleaseNotesTool;
  /** Only output the raw context (no prompt wrapping) */
  readonly contextOnly?: boolean;
}
