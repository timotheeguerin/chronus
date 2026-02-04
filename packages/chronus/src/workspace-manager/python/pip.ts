import { parse } from "smol-toml";
import { isPathAccessible } from "../../utils/fs-utils.js";
import type { ChronusHost } from "../../utils/host.js";
import { isDefined } from "../../utils/misc-utils.js";
import { joinPaths, resolvePath } from "../../utils/path-utils.js";
import type { Ecosystem, Package, PackageDependencySpec, PatchPackageVersion } from "../types.js";

const pyprojectFile = "pyproject.toml";
const defaultIgnorePatterns = [
  "**/node_modules",
  "**/__pycache__",
  "**/venv",
  "**/.venv",
  "**/_vendor",
  "**/_generated",
];

export interface PyprojectToml {
  project?: {
    "name"?: string;
    "version"?: string;
    "dependencies"?: string[];
    "optional-dependencies"?: Record<string, string[]>;
    "dynamic"?: string[];
  };
  tool?: {
    // Setuptools: [tool.setuptools.dynamic.version]
    setuptools?: { dynamic?: { version?: { attr?: string; file?: string | string[] } } };
    // Hatch: [tool.hatch.version]
    hatch?: { version?: { path?: string; pattern?: string } };
    // Flit: reads __version__ from module
    flit?: { module?: { name?: string } };
    // PDM: [tool.pdm.version]
    pdm?: { version?: { source?: string; path?: string } };
  };
}

export class PipWorkspaceManager implements Ecosystem {
  type = "python:pip";
  aliases = ["pip"];

  async is(host: ChronusHost, dir: string): Promise<boolean> {
    return isPathAccessible(host, joinPaths(dir, pyprojectFile));
  }

  async loadPattern(host: ChronusHost, root: string, pattern: string): Promise<Package[]> {
    const dirs = await host.glob(pattern, { baseDir: root, onlyDirectories: true, ignore: defaultIgnorePatterns });
    const packages = await Promise.all(dirs.map((x) => tryLoadPackage(host, root, x)));
    return packages.filter(isDefined);
  }

  async load(host: ChronusHost, root: string, relativePath: string): Promise<Package[]> {
    const pkg = await tryLoadPackage(host, root, relativePath);
    return pkg ? [pkg] : [];
  }

  async updateVersionsForPackage(
    host: ChronusHost,
    workspaceRoot: string,
    pkg: Package,
    patchRequest: PatchPackageVersion,
  ): Promise<void> {
    const packageRoot = resolvePath(workspaceRoot, pkg.relativePath);
    const pyprojectPath = resolvePath(packageRoot, pyprojectFile);

    if (!(await isPathAccessible(host, pyprojectPath))) return;

    const file = await host.readFile(pyprojectPath);
    const pyproject = parse(file.content) as PyprojectToml;
    if (!pyproject.project?.name) return;

    const isDynamic = pyproject.project.dynamic?.includes("version");

    // Update version
    if (isDynamic) {
      await updateVersionInPythonFile(host, packageRoot, getVersionFilePath(pyproject), patchRequest.newVersion!);
    } else {
      const updated = file.content.replace(
        /(\[project\][\s\S]*?version\s*=\s*)"[^"]+"/,
        `$1"${patchRequest.newVersion}"`,
      );
      await host.writeFile(pyprojectPath, updated);
    }
  }
}

export async function tryLoadPackage(
  host: ChronusHost,
  root: string,
  relativePath: string,
): Promise<Package | undefined> {
  const pyprojectPath = resolvePath(root, relativePath, pyprojectFile);
  if (!(await isPathAccessible(host, pyprojectPath))) return undefined;

  const pyproject = parse((await host.readFile(pyprojectPath)).content) as PyprojectToml;
  const project = pyproject.project;
  if (!project?.name) return undefined;

  let version = project.version;
  if (project.dynamic?.includes("version") || !version) {
    const packageRoot = resolvePath(root, relativePath);
    version = await readVersionFromFile(host, packageRoot, getVersionFilePath(pyproject));
    if (!version) return undefined;
  }

  return {
    name: project.name,
    version,
    ecosystem: "python:pip",
    relativePath,
    dependencies: new Map([
      ...parseDeps(project.dependencies, "prod"),
      ...parseDeps(project["optional-dependencies"], "dev"),
    ]),
  };
}

/** Get version file path from pyproject.toml backend configuration. */
function getVersionFilePath(pyproject: PyprojectToml): string | undefined {
  const tool = pyproject.tool;

  // Setuptools: attr="pkg._version.VERSION" or file="VERSION.txt"
  const setuptools = tool?.setuptools?.dynamic?.version;
  if (setuptools?.file) {
    return Array.isArray(setuptools.file) ? setuptools.file[0] : setuptools.file;
  }
  if (setuptools?.attr) {
    const parts = setuptools.attr.split(".");
    parts.pop();
    return parts.join("/") + ".py";
  }

  // Hatch: path="src/pkg/_version.py"
  if (tool?.hatch?.version?.path) {
    return tool.hatch.version.path;
  }

  // PDM: source="file", path="pkg/_version.py"
  if (tool?.pdm?.version?.source === "file" && tool.pdm.version.path) {
    return tool.pdm.version.path;
  }

  return undefined;
}

/** Read version from a Python file. */
async function readVersionFromFile(
  host: ChronusHost,
  packageRoot: string,
  filePath: string | undefined,
): Promise<string | undefined> {
  const patterns = filePath ? [filePath] : ["**/_version.py", "**/version.py", "**/__init__.py"];

  for (const pattern of patterns) {
    const files = await host.glob(pattern, { baseDir: packageRoot, ignore: defaultIgnorePatterns });
    if (files.length > 0) {
      const content = (await host.readFile(resolvePath(packageRoot, files[0]))).content;
      // Match VERSION = "x.y.z" or __version__ = "x.y.z"
      const match = content.match(/(?:VERSION|__version__)\s*=\s*["']([^"']+)["']/);
      if (match) return match[1];
    }
  }
  return undefined;
}

/** Update version in a Python file. */
async function updateVersionInPythonFile(
  host: ChronusHost,
  packageRoot: string,
  filePath: string | undefined,
  newVersion: string,
): Promise<void> {
  const patterns = filePath ? [filePath] : ["**/_version.py", "**/version.py", "**/__init__.py"];

  for (const pattern of patterns) {
    const files = await host.glob(pattern, { baseDir: packageRoot, ignore: defaultIgnorePatterns });
    if (files.length > 0) {
      const fullPath = resolvePath(packageRoot, files[0]);
      const content = (await host.readFile(fullPath)).content;
      const updated = content.replace(/((?:VERSION|__version__)\s*=\s*["'])[^"']+["']/, `$1${newVersion}"`);
      await host.writeFile(fullPath, updated);
      return;
    }
  }
}

/** Parse dependency specs into name/version pairs. */
function parseDeps(
  deps: string[] | Record<string, string[]> | undefined,
  kind: "prod" | "dev",
): [string, PackageDependencySpec][] {
  if (!deps) return [];
  const list = Array.isArray(deps) ? deps : Object.values(deps).flat();
  return list.map((spec) => {
    const match = spec.match(/^([a-zA-Z0-9._-]+)(?:\[[^\]]+\])?\s*(.*)$/);
    const name = match?.[1] ?? spec;
    const version = match?.[2]?.trim() || "*";
    return [name, { name, version, kind }];
  });
}
