import { parse } from "smol-toml";
import { isPathAccessible } from "../../utils/fs-utils.js";
import type { ChronusHost } from "../../utils/host.js";
import { isDefined } from "../../utils/misc-utils.js";
import { joinPaths, resolvePath } from "../../utils/path-utils.js";
import type { Package, PackageDependencySpec, PatchPackageVersion, Workspace, WorkspaceManager } from "../types.js";

const pyprojectFile = "pyproject.toml";
const setupPyFile = "setup.py";

export interface PyprojectToml {
  "project"?: {
    name?: string;
    version?: string;
    dependencies?: string[];
    "optional-dependencies"?: Record<string, string[]>;
  };
}

export class PipWorkspaceManager implements WorkspaceManager {
  type = "python:pip";
  aliases = ["pip"];

  async is(host: ChronusHost, dir: string): Promise<boolean> {
    // Check for pyproject.toml
    const pyprojectPath = joinPaths(dir, pyprojectFile);
    if (await isPathAccessible(host, pyprojectPath)) {
      return true;
    }
    
    // Check for setup.py
    const setupPyPath = joinPaths(dir, setupPyFile);
    return isPathAccessible(host, setupPyPath);
  }

  async load(host: ChronusHost, root: string): Promise<Workspace> {
    // Python pip doesn't have explicit workspace members, so we'll look for packages in common patterns
    const packages: Package[] = [];
    
    // Try to find packages in common patterns
    const possiblePackageDirs = ["packages/*", "libs/*", "apps/*"];
    
    for (const pattern of possiblePackageDirs) {
      const foundPackages = await findPackagesFromPattern(host, root, pattern);
      packages.push(...foundPackages);
    }

    // If no packages found, check if the root itself is a package
    if (packages.length === 0) {
      const rootPackage = await tryLoadPackage(host, root, ".");
      if (rootPackage) {
        packages.push(rootPackage);
      }
    }

    return {
      type: "python:pip",
      path: root,
      packages,
    };
  }

  async updateVersionsForPackage(
    host: ChronusHost,
    workspace: Workspace,
    pkg: Package,
    patchRequest: PatchPackageVersion,
  ): Promise<void> {
    // Try pyproject.toml first
    const pyprojectTomlPath = resolvePath(workspace.path, pkg.relativePath, pyprojectFile);
    if (await isPathAccessible(host, pyprojectTomlPath)) {
      const file = await host.readFile(pyprojectTomlPath);
      let content = file.content;

      // Update package version
      if (patchRequest.newVersion) {
        content = updatePyprojectVersion(content, patchRequest.newVersion);
      }

      // Update dependency versions
      for (const [depName, newVersion] of Object.entries(patchRequest.dependenciesVersions)) {
        content = updatePyprojectDependencyVersion(content, depName, newVersion);
      }

      await host.writeFile(pyprojectTomlPath, content);
      return;
    }

    // Try setup.py
    const setupPyPath = resolvePath(workspace.path, pkg.relativePath, setupPyFile);
    if (await isPathAccessible(host, setupPyPath)) {
      const file = await host.readFile(setupPyPath);
      let content = file.content;

      // Update package version
      if (patchRequest.newVersion) {
        content = updateSetupPyVersion(content, patchRequest.newVersion);
      }

      // Update dependency versions
      for (const [depName, newVersion] of Object.entries(patchRequest.dependenciesVersions)) {
        content = updateSetupPyDependencyVersion(content, depName, newVersion);
      }

      await host.writeFile(setupPyPath, content);
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
    ignore: ["**/node_modules", "**/__pycache__", "**/venv", "**/.venv"],
  });

  const packages = await Promise.all(packageRoots.map((x) => tryLoadPackage(host, root, x)));
  return packages.filter(isDefined);
}

export async function tryLoadPackage(
  host: ChronusHost,
  root: string,
  relativePath: string,
): Promise<Package | undefined> {
  // Try pyproject.toml first
  const pyprojectPath = resolvePath(root, relativePath, pyprojectFile);
  if (await isPathAccessible(host, pyprojectPath)) {
    const file = await host.readFile(pyprojectPath);
    const pyprojectToml = parse(file.content) as PyprojectToml;
    
    // PEP 621 format
    if (pyprojectToml.project) {
      const project = pyprojectToml.project;
      if (!project.name || !project.version) {
        return undefined;
      }
      return {
        name: project.name,
        version: project.version,
        relativePath: relativePath,
        dependencies: new Map([
          ...mapPep621Dependencies(project.dependencies, "prod"),
          ...(project["optional-dependencies"]
            ? Object.values(project["optional-dependencies"]).flatMap((deps) => mapPep621Dependencies(deps, "dev"))
            : []),
        ]),
      };
    }
  }
  
  // Try setup.py
  const setupPyPath = resolvePath(root, relativePath, setupPyFile);
  if (await isPathAccessible(host, setupPyPath)) {
    const file = await host.readFile(setupPyPath);
    const packageInfo = parseSetupPy(file.content);
    if (packageInfo.name && packageInfo.version) {
      return {
        name: packageInfo.name,
        version: packageInfo.version,
        relativePath: relativePath,
        dependencies: new Map([
          ...mapSetupPyDependencies(packageInfo.install_requires, "prod"),
          ...mapSetupPyDependencies(packageInfo.extras_require?.dev, "dev"),
        ]),
      };
    }
  }
  
  return undefined;
}

function mapSetupPyDependencies(deps: string[] | undefined, kind: "prod" | "dev"): [string, PackageDependencySpec][] {
  if (!deps) return [];
  return deps.map((depSpec) => {
    // Parse dependency specification like "package>=1.0.0" or "package[extra]>=1.0.0"
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

function mapPep621Dependencies(deps: string[] | undefined, kind: "prod" | "dev"): [string, PackageDependencySpec][] {
  if (!deps) return [];
  return deps.map((depSpec) => {
    // Parse dependency specification like "package>=1.0.0" or "package[extra]>=1.0.0"
    // Python package names can contain letters, numbers, dots, hyphens, and underscores
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

interface SetupPyInfo {
  name?: string;
  version?: string;
  install_requires?: string[];
  extras_require?: Record<string, string[]>;
}

/**
 * Parse setup.py to extract package information
 */
function parseSetupPy(content: string): SetupPyInfo {
  const info: SetupPyInfo = {};
  
  // Extract name
  const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
  if (nameMatch) info.name = nameMatch[1];
  
  // Extract version
  const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
  if (versionMatch) info.version = versionMatch[1];
  
  // Extract install_requires
  const installRequiresMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
  if (installRequiresMatch) {
    info.install_requires = installRequiresMatch[1]
      .split(",")
      .map((dep) => dep.trim().replace(/^["']|["']$/g, ""))
      .filter((dep) => dep.length > 0);
  }
  
  // Extract extras_require
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

/**
 * Update the package version in pyproject.toml [project] section.
 */
function updatePyprojectVersion(content: string, newVersion: string): string {
  const projectSectionRegex = /(\[project\][\s\S]*?)(version\s*=\s*)"([^"]+)"/;
  return content.replace(projectSectionRegex, `$1$2"${newVersion}"`);
}

/**
 * Update a dependency version in pyproject.toml
 */
function updatePyprojectDependencyVersion(content: string, depName: string, newVersion: string): string {
  // Escape special regex characters in dependency name
  const escapedName = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
  // Match dependencies array entries like "package>=1.0.0" or "package[extra]>=1.0.0"
  const depPattern = new RegExp(`"${escapedName}(?:\\[[^\\]]+\\])?[^"]*"`, "g");
  return content.replace(depPattern, `"${depName}>=${newVersion}"`);
}

/**
 * Update the package version in setup.py
 */
function updateSetupPyVersion(content: string, newVersion: string): string {
  return content.replace(/version\s*=\s*["']([^"']+)["']/, `version="${newVersion}"`);
}

/**
 * Update a dependency version in setup.py
 */
function updateSetupPyDependencyVersion(content: string, depName: string, newVersion: string): string {
  // Escape special regex characters in dependency name
  const escapedName = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
  // Match dependencies like "package>=1.0.0" or 'package>=1.0.0'
  const depPattern = new RegExp(`["']${escapedName}(?:\\[[^\\]]+\\])?[^"']*["']`, "g");
  return content.replace(depPattern, `"${depName}>=${newVersion}"`);
}
