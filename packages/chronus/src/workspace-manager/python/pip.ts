import { parse } from "smol-toml";
import { isPathAccessible } from "../../utils/fs-utils.js";
import type { ChronusHost } from "../../utils/host.js";
import { isDefined } from "../../utils/misc-utils.js";
import { joinPaths, resolvePath } from "../../utils/path-utils.js";
import type { Ecosystem, Package, PackageDependencySpec, PatchPackageVersion } from "../types.js";

const pyprojectFile = "pyproject.toml";
const setupPyFile = "setup.py";
const versionFileNames = ["_version.py", "version.py"];
const defaultIgnorePatterns = ["**/node_modules", "**/__pycache__", "**/venv", "**/.venv", "**/samples", "**/_vendor"];

export interface PyprojectToml {
  project?: {
    "name"?: string;
    "version"?: string;
    "dependencies"?: string[];
    "optional-dependencies"?: Record<string, string[]>;
    "dynamic"?: string[];
  };
}

interface PythonPackageInfo {
  name: string;
  version: string;
  dependencies: string[];
  devDependencies: string[];
}

interface SetupPyInfo {
  name?: string;
  version?: string;
  versionFile?: string;
  install_requires?: string[];
  extras_require?: Record<string, string[]>;
}

export class PipWorkspaceManager implements Ecosystem {
  type = "python:pip";
  aliases = ["pip"];

  async is(host: ChronusHost, dir: string): Promise<boolean> {
    const setupPyPath = joinPaths(dir, setupPyFile);
    if (await isPathAccessible(host, setupPyPath)) {
      return true;
    }
    const pyprojectPath = joinPaths(dir, pyprojectFile);
    if (await isPathAccessible(host, pyprojectPath)) {
      return true;
    }
    return false;
  }

  async loadPattern(host: ChronusHost, root: string, pattern: string): Promise<Package[]> {
    return await findPackagesFromPattern(host, root, pattern);
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
    const pyprojectTomlPath = resolvePath(workspaceRoot, pkg.relativePath, pyprojectFile);
    let usesPyprojectForPackaging = false;

    if (await isPathAccessible(host, pyprojectTomlPath)) {
      const file = await host.readFile(pyprojectTomlPath);
      const pyprojectToml = parse(file.content) as PyprojectToml;

      if (pyprojectToml.project?.name) {
        usesPyprojectForPackaging = true;
        const isDynamicVersion = pyprojectToml.project?.dynamic?.includes("version");

        if (patchRequest.newVersion && isDynamicVersion) {
          await updateVersionInFile(host, workspaceRoot, pkg.relativePath, patchRequest.newVersion);
        }

        let pyprojectContent = file.content;
        let hasPyprojectChanges = false;

        if (patchRequest.newVersion && !isDynamicVersion) {
          pyprojectContent = updatePyprojectVersion(pyprojectContent, patchRequest.newVersion);
          hasPyprojectChanges = true;
        }

        for (const [depName, newVersion] of Object.entries(patchRequest.dependenciesVersions)) {
          pyprojectContent = updatePyprojectDependencyVersion(pyprojectContent, depName, newVersion);
          hasPyprojectChanges = true;
        }

        if (hasPyprojectChanges) {
          await host.writeFile(pyprojectTomlPath, pyprojectContent);
        }
      }
    }

    if (!usesPyprojectForPackaging) {
      const setupPyPath = resolvePath(workspaceRoot, pkg.relativePath, setupPyFile);
      if (await isPathAccessible(host, setupPyPath)) {
        const file = await host.readFile(setupPyPath);
        const packageInfo = parseSetupPy(file.content);

        if (patchRequest.newVersion && packageInfo.versionFile) {
          await updateVersionInFile(host, workspaceRoot, pkg.relativePath, patchRequest.newVersion);
        }

        let setupPyContent = file.content;
        let hasSetupPyChanges = false;

        if (patchRequest.newVersion && !packageInfo.versionFile) {
          setupPyContent = updateSetupPyVersion(setupPyContent, patchRequest.newVersion);
          hasSetupPyChanges = true;
        }

        for (const [depName, newVersion] of Object.entries(patchRequest.dependenciesVersions)) {
          setupPyContent = updateSetupPyDependencyVersion(setupPyContent, depName, newVersion);
          hasSetupPyChanges = true;
        }

        if (hasSetupPyChanges) {
          await host.writeFile(setupPyPath, setupPyContent);
        }
      }
    }
  }
}

export async function findPackagesFromPattern(
  host: ChronusHost,
  root: string,
  pattern: string | string[],
): Promise<Package[]> {
  const packageRoots = await host.glob(pattern, {
    baseDir: root,
    onlyDirectories: true,
    ignore: defaultIgnorePatterns,
  });

  const packages = await Promise.all(packageRoots.map((x) => tryLoadPackage(host, root, x)));
  return packages.filter(isDefined);
}

/** Read version from _version.py or version.py file. */
async function readVersionFromFile(host: ChronusHost, root: string, relativePath: string): Promise<string | undefined> {
  const packageRoot = resolvePath(root, relativePath);
  for (const versionFileName of versionFileNames) {
    const foundFiles = await host.glob(`**/${versionFileName}`, {
      baseDir: packageRoot,
      ignore: defaultIgnorePatterns,
    });
    if (foundFiles.length > 0) {
      const versionFileContent = await host.readFile(resolvePath(packageRoot, foundFiles[0]));
      const versionMatch = versionFileContent.content.match(/VERSION\s*=\s*["']([^"']+)["']/);
      if (versionMatch) {
        return versionMatch[1];
      }
    }
  }
  return undefined;
}

/** Update version in _version.py or version.py file. */
async function updateVersionInFile(
  host: ChronusHost,
  root: string,
  relativePath: string,
  newVersion: string,
): Promise<boolean> {
  const packageRoot = resolvePath(root, relativePath);
  for (const versionFileName of versionFileNames) {
    const foundFiles = await host.glob(`**/${versionFileName}`, {
      baseDir: packageRoot,
      ignore: defaultIgnorePatterns,
    });
    if (foundFiles.length > 0) {
      const versionFilePath = resolvePath(packageRoot, foundFiles[0]);
      const versionFile = await host.readFile(versionFilePath);
      const updatedContent = versionFile.content.replace(/VERSION\s*=\s*["']([^"']+)["']/, `VERSION = "${newVersion}"`);
      await host.writeFile(versionFilePath, updatedContent);
      return true;
    }
  }
  return false;
}

export async function tryLoadPackage(
  host: ChronusHost,
  root: string,
  relativePath: string,
): Promise<Package | undefined> {
  const info =
    (await tryLoadFromPyproject(host, root, relativePath)) ?? (await tryLoadFromSetupPy(host, root, relativePath));

  if (!info) {
    return undefined;
  }

  return {
    name: info.name,
    version: info.version,
    ecosystem: "python:pip",
    relativePath: relativePath,
    dependencies: new Map([
      ...parseDependencies(info.dependencies, "prod"),
      ...parseDependencies(info.devDependencies, "dev"),
    ]),
  };
}

async function tryLoadFromPyproject(
  host: ChronusHost,
  root: string,
  relativePath: string,
): Promise<PythonPackageInfo | undefined> {
  const pyprojectPath = resolvePath(root, relativePath, pyprojectFile);
  if (!(await isPathAccessible(host, pyprojectPath))) {
    return undefined;
  }

  const file = await host.readFile(pyprojectPath);
  const pyprojectToml = parse(file.content) as PyprojectToml;
  const project = pyprojectToml.project;
  if (!project?.name) {
    return undefined;
  }

  let version = project.version;
  const isDynamicVersion = project.dynamic?.includes("version");

  if (isDynamicVersion || !version) {
    const versionFromFile = await readVersionFromFile(host, root, relativePath);
    if (versionFromFile) {
      version = versionFromFile;
    } else if (isDynamicVersion) {
      console.warn(`Package ${project.name} at ${relativePath} has dynamic version but no version file found`);
      return undefined;
    }
  }

  if (!version) {
    return undefined;
  }

  return {
    name: project.name,
    version,
    dependencies: project.dependencies ?? [],
    devDependencies: project["optional-dependencies"] ? Object.values(project["optional-dependencies"]).flat() : [],
  };
}

async function tryLoadFromSetupPy(
  host: ChronusHost,
  root: string,
  relativePath: string,
): Promise<PythonPackageInfo | undefined> {
  const setupPyPath = resolvePath(root, relativePath, setupPyFile);
  if (!(await isPathAccessible(host, setupPyPath))) {
    return undefined;
  }

  const file = await host.readFile(setupPyPath);
  const packageInfo = parseSetupPy(file.content);

  if (!packageInfo.name) {
    return undefined;
  }

  let version = packageInfo.version;
  if (!version && packageInfo.versionFile) {
    const versionFromFile = await readVersionFromFile(host, root, relativePath);
    if (versionFromFile) {
      version = versionFromFile;
    } else {
      console.warn(
        `Package ${packageInfo.name} at ${relativePath} references ${packageInfo.versionFile} but file not found`,
      );
      return undefined;
    }
  }

  if (!version) {
    return undefined;
  }

  return {
    name: packageInfo.name,
    version,
    dependencies: packageInfo.install_requires ?? [],
    devDependencies: packageInfo.extras_require?.dev ?? [],
  };
}

/** Parse Python dependency specifications (e.g. "package>=1.0.0"). */
function parseDependencies(deps: string[] | undefined, kind: "prod" | "dev"): [string, PackageDependencySpec][] {
  if (!deps) return [];
  return deps.map((depSpec) => {
    const match = depSpec.match(/^([a-zA-Z0-9._-]+)(?:\[[^\]]+\])?\s*(.*)$/);
    if (!match) {
      return [depSpec, { name: depSpec, version: "*", kind }];
    }
    const [, name, version] = match;
    return [
      name,
      {
        name,
        version: version.trim() || "*",
        kind,
      } as PackageDependencySpec,
    ];
  });
}

/** Parse setup.py to extract package information. */
function parseSetupPy(content: string): SetupPyInfo {
  const info: SetupPyInfo = {};

  const directNameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
  const packageNameMatch = content.match(/PACKAGE_NAME\s*=\s*["']([^"']+)["']/);
  info.name = directNameMatch?.[1] ?? packageNameMatch?.[1];

  if (content.includes("with open")) {
    const versionFileMatches = content.match(/["']((?:_)?version\.py)["']/g);
    if (versionFileMatches) {
      const preferredFile = versionFileMatches.find((m) => m.includes("_version.py")) ?? versionFileMatches[0];
      info.versionFile = preferredFile.replace(/["']/g, "");
    }
  }

  info.version = content.match(/version\s*=\s*["']([^"']+)["']/)?.[1];

  const installRequiresMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
  if (installRequiresMatch) {
    info.install_requires = installRequiresMatch[1]
      .split(",")
      .map((dep) => dep.trim().replace(/^["']|["']$/g, ""))
      .filter((dep) => dep.length > 0);
  }

  const extrasRequireMatch = content.match(/extras_require\s*=\s*\{([\s\S]*?)\}/);
  if (extrasRequireMatch) {
    info.extras_require = {};
    const extrasContent = extrasRequireMatch[1];
    const keyMatches = extrasContent.matchAll(/["']([^"']+)["']\s*:\s*\[([\s\S]*?)\]/g);
    for (const match of keyMatches) {
      const key = match[1];
      const deps = match[2]
        .split(",")
        .map((dep) => dep.trim().replace(/^["']|["']$/g, ""))
        .filter((dep) => dep.length > 0);
      info.extras_require[key] = deps;
    }
  }

  return info;
}

/** Update the package version in pyproject.toml. */
function updatePyprojectVersion(content: string, newVersion: string): string {
  const projectSectionRegex = /(\[project\][\s\S]*?)(version\s*=\s*)"([^"]+)"/;
  return content.replace(projectSectionRegex, `$1$2"${newVersion}"`);
}

/** Update a dependency version in pyproject.toml. */
function updatePyprojectDependencyVersion(content: string, depName: string, newVersion: string): string {
  const escapedName = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const depPattern = new RegExp(`"${escapedName}(?:\\[[^\\]]+\\])?[^"]*"`, "g");
  return content.replace(depPattern, `"${depName}>=${newVersion}"`);
}

/** Update the package version in setup.py. */
function updateSetupPyVersion(content: string, newVersion: string): string {
  return content.replace(/version\s*=\s*["']([^"']+)["']/, `version="${newVersion}"`);
}

/** Update a dependency version in setup.py. */
function updateSetupPyDependencyVersion(content: string, depName: string, newVersion: string): string {
  const escapedName = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const depPattern = new RegExp(`["']${escapedName}(?:\\[[^\\]]+\\])?[^"']*["']`, "g");
  return content.replace(depPattern, `"${depName}>=${newVersion}"`);
}
