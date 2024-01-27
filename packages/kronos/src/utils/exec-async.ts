import type { SpawnOptions } from "child_process";
import crosspawn from "cross-spawn";

export interface ExecResult {
  code: number | null;
  stdout: Buffer;
  stderr: Buffer;
}
export function execAsync(cmd: string, args: string[], opts: SpawnOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = crosspawn(cmd, args, opts);
    let stdout = Buffer.from("");
    let stderr = Buffer.from("");

    if (child.stdout) {
      child.stdout.on("data", (data) => {
        stdout = Buffer.concat([stdout, data]);
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (data) => {
        stderr = Buffer.concat([stderr, data]);
      });
    }

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}
