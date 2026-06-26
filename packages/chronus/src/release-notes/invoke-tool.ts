import pc from "picocolors";
import { isCI } from "std-env";
import { ChronusError } from "../utils/errors.js";
import { execAsync } from "../utils/exec-async.js";
import { F_CHECK, F_CROSS } from "../utils/figures.js";
import { createSpinner } from "../reporters/utils.js";
import type { ReleaseNotesTool } from "./types.js";

interface ToolInvocation {
  readonly command: string;
  /** Build the CLI args. The prompt is passed here when the tool reads it as an argument. */
  readonly args: (prompt: string) => string[];
  /** When true, the prompt is written to the process stdin instead of passed as an argument. */
  readonly promptViaStdin: boolean;
}

const tools: Record<Exclude<ReleaseNotesTool, "none">, ToolInvocation> = {
  // GitHub Copilot CLI: prompt is passed via `-p`; `--allow-all-tools` is required for
  // non-interactive mode and `--output-format text` prints the final response to stdout.
  // Deny file/shell tools so it generates the notes as text instead of editing the repo.
  copilot: {
    command: "copilot",
    args: (prompt) => [
      "-p",
      prompt,
      "--allow-all-tools",
      "--deny-tool",
      "write",
      "--deny-tool",
      "edit",
      "--deny-tool",
      "create",
      "--deny-tool",
      "str_replace",
      "--deny-tool",
      "str_replace_editor",
      "--deny-tool",
      "apply_patch",
      "--deny-tool",
      "shell",
      "--deny-tool",
      "bash",
      "--no-ask-user",
      "--output-format",
      "text",
    ],
    promptViaStdin: false,
  },
  // Claude Code CLI: `-p/--print` runs non-interactively and reads the prompt from stdin.
  claude: {
    command: "claude",
    args: () => ["-p", "--output-format", "text"],
    promptViaStdin: true,
  },
};

/**
 * Render a spinner with a status message to stderr while `action` runs, so progress is
 * visible without polluting stdout (which carries the generated release notes). Falls back
 * to a single status line when stderr is not an interactive terminal.
 */
async function withSpinner<T>(message: string, action: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const elapsed = () => `${((Date.now() - start) / 1000).toFixed(0)}s`;
  const isTTY = Boolean(process.stderr.isTTY) && !isCI;

  if (!isTTY) {
    process.stderr.write(`${pc.yellow("-")} ${message}\n`);
    try {
      const result = await action();
      process.stderr.write(`${pc.green(F_CHECK)} ${message} (${elapsed()})\n`);
      return result;
    } catch (error) {
      process.stderr.write(`${pc.red(F_CROSS)} ${message} (${elapsed()})\n`);
      throw error;
    }
  }

  const spinner = createSpinner();
  const render = () => {
    process.stderr.clearLine(0);
    process.stderr.cursorTo(0);
    process.stderr.write(`${pc.yellow(spinner())} ${message} ${pc.gray(`(${elapsed()})`)}`);
  };
  const interval = setInterval(render, 300);
  render();
  try {
    const result = await action();
    clearInterval(interval);
    process.stderr.clearLine(0);
    process.stderr.cursorTo(0);
    process.stderr.write(`${pc.green(F_CHECK)} ${message} ${pc.gray(`(${elapsed()})`)}\n`);
    return result;
  } catch (error) {
    clearInterval(interval);
    process.stderr.clearLine(0);
    process.stderr.cursorTo(0);
    process.stderr.write(`${pc.red(F_CROSS)} ${message} ${pc.gray(`(${elapsed()})`)}\n`);
    throw error;
  }
}

/**
 * Run the rendered prompt through an AI CLI (`copilot` or `claude`) in non-interactive
 * mode and return its stdout as the generated release notes.
 */
export async function invokeReleaseNotesTool(
  tool: Exclude<ReleaseNotesTool, "none">,
  prompt: string,
): Promise<string> {
  const invocation = tools[tool];
  if (!invocation) {
    throw new ChronusError(`Unknown release notes tool '${tool}'. Expected one of: copilot, claude, none.`);
  }

  return withSpinner(`Generating release notes with ${pc.cyan(invocation.command)}…`, async () => {
    let result;
    try {
      result = await execAsync(
        invocation.command,
        invocation.args(prompt),
        { stdio: ["pipe", "pipe", "pipe"] },
        invocation.promptViaStdin ? prompt : "",
      );
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        throw new ChronusError(
          `Could not find the '${invocation.command}' CLI on PATH. Install it or run with '--tool none' to only print the prompt.`,
        );
      }
      throw error;
    }

    if (result.code !== 0) {
      // CLIs may report errors on stdout or stderr, so surface both.
      const details = result.stdall.toString().trim();
      throw new ChronusError(`'${invocation.command}' exited with code ${result.code}.\n${details}`);
    }

    return result.stdout.toString();
  });
}
