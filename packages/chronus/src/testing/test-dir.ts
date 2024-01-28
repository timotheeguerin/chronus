import { randomBytes } from "node:crypto";
import { writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

async function tempdir(): Promise<string> {
  const date = new Date().toJSON().slice(0, -5);
  const uid = randomBytes(8).toString("hex");
  const path = join(process.cwd(), `.temp/tests/${date}/${uid}`);
  await mkdir(path, { recursive: true });
  return path;
}

export interface TestDir {
  readonly path: string;
  addFile(path: string, content?: string): Promise<void>;
  writeFile(path: string, content?: string): Promise<void>;
}

export async function createTestDir(): Promise<TestDir> {
  const testDirPath = await tempdir();

  return {
    path: testDirPath,
    addFile,
    writeFile,
  };

  async function addFile(path: string, content: string = "") {
    const fullpath = join(testDirPath, path);
    const dir = dirname(fullpath);
    await mkdir(dir, { recursive: true });
    await fsWriteFile(fullpath, content);
  }

  async function writeFile(path: string, content: string = "") {
    const fullpath = join(testDirPath, path);
    await fsWriteFile(fullpath, content);
  }
}
