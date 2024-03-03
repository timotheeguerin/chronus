import { ChronusError, execAsync } from "@chronus/chronus/utils";
import crosspawn from "cross-spawn";

export async function getGithubToken(interactive?: boolean): Promise<string> {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  } else {
    const result = await getCurrentGhCliToken();
    if (result.success) {
      return result.token;
    } else {
      if (result.code === "not-installed") {
        throwCannotResolveTokenError();
      } else if (result.code === "not-logged" && interactive) {
        return await loginAndGetToken();
      }
      throwCannotResolveTokenError();
    }
  }
}

function throwCannotResolveTokenError(): never {
  throw new ChronusError(
    "Failed to retrieve github token. Make sure to have `GITHUB_TOKEN` environment variable set or have github cli installed.",
  );
}

async function loginAndGetToken() {
  await loginInGhCli();
  const result = await getCurrentGhCliToken();
  if (result.success) {
    return result.token;
  } else {
    throwCannotResolveTokenError();
  }
}

function loginInGhCli() {
  return new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line no-console
    console.log("Chronus will try to login using the github cli.");
    const child = crosspawn("gh", ["auth", "login"], { stdio: "inherit" });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject("Command failed");
      }
      resolve();
    });
  });
}

async function getCurrentGhCliToken(): Promise<GetGithubCliTokenResult> {
  try {
    const result = await execAsync("gh", ["auth", "token"]);
    if (result.code === 0) {
      return { success: true, token: result.stdout.toString().trim() };
    } else {
      return { success: false, code: "not-logged", out: result.stdall.toString() };
    }
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return { success: false, code: "not-installed" };
    }
    throw e;
  }
}

type GetGithubCliTokenResult = GetGithubCliTokenSuccess | GetGithubCliTokenFailure;

interface GetGithubCliTokenSuccess {
  success: true;
  token: string;
}

interface GetGithubCliTokenFailure {
  success: false;
  code: "not-installed" | "not-logged";
  out?: string;
}
