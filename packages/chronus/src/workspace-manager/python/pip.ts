import { parse } from "smol-toml";
import { isPathAccessible } from "../../utils/fs-utils.js";
import type { ChronusHost } from "../../utils/host.js";
import { isDefined } from "../../utils/misc-utils.js";
import { joinPaths, resolvePath } from "../../utils/path-utils.js";
import type { Package, PackageDependencySpec, PatchPackageVersion, Workspace, WorkspaceManager } from "../types.js";

const pyprojectFile = "pyproject.toml";
const setupPyFile = "setup.py";
const versionFiles = ["_version.py", "version.py"];

export interface PyprojectToml {
  "project"?: {
    name?: string;
    version?: string;
    dependencies?: string[];
    "optional-dependencies"?: Record<string, string[]>;
    dynamic?: string[]; // PEP 621: fields like "version" can be marked as dynamic
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
    const possiblePackageDirs = ["sdk/*", "sdk/*/*"];
    
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
    // Determine which file contains the packaging configuration
    // Check pyproject.toml first to see if it has [project] section with packaging info
    const pyprojectTomlPath = resolvePath(workspace.path, pkg.relativePath, pyprojectFile);
    let usesPyprojectForPackaging = false;
    
    if (await isPathAccessible(host, pyprojectTomlPath)) {
      const file = await host.readFile(pyprojectTomlPath);
      const pyprojectToml = parse(file.content) as PyprojectToml;
      
      // If pyproject.toml has [project] section with name, it's used for packaging
      if (pyprojectToml.project?.name) {
        usesPyprojectForPackaging = true;
        
        // Check if version is marked as dynamic (Azure SDK pattern)
        const isDynamicVersion = pyprojectToml.project?.dynamic?.includes("version");
        
        // Update version in _version.py if it's dynamic
        if (patchRequest.newVersion && isDynamicVersion) {
          await updateVersionInFile(host, workspace.path, pkg.relativePath, pkg.name, patchRequest.newVersion);
        }
        
        // Update pyproject.toml (version if not dynamic, and dependencies)
        let pyprojectContent = file.content;
        let hasPyprojectChanges = false;
        
        // Update version in pyproject.toml if it's not dynamic
        if (patchRequest.newVersion && !isDynamicVersion) {
          pyprojectContent = updatePyprojectVersion(pyprojectContent, patchRequest.newVersion);
          hasPyprojectChanges = true;
        }

        // Update dependency versions in pyproject.toml
        for (const [depName, newVersion] of Object.entries(patchRequest.dependenciesVersions)) {
          pyprojectContent = updatePyprojectDependencyVersion(pyprojectContent, depName, newVersion);
          hasPyprojectChanges = true;
        }
        
        if (hasPyprojectChanges) {
          await host.writeFile(pyprojectTomlPath, pyprojectContent);
        }
      }
    }

    // If pyproject.toml doesn't have packaging info, update setup.py
    if (!usesPyprojectForPackaging) {
      const setupPyPath = resolvePath(workspace.path, pkg.relativePath, setupPyFile);
      if (await isPathAccessible(host, setupPyPath)) {
        const file = await host.readFile(setupPyPath);
        const packageInfo = parseSetupPy(file.content);
        
        // Update version in separate file if it exists
        if (patchRequest.newVersion && packageInfo.versionFile) {
          await updateVersionInFile(host, workspace.path, pkg.relativePath, pkg.name, patchRequest.newVersion);
        }
        
        // Update setup.py for version (if not in separate file) and dependencies
        let setupPyContent = file.content;
        let hasSetupPyChanges = false;
        
        // Update version in setup.py if it's not in a separate file
        if (patchRequest.newVersion && !packageInfo.versionFile) {
          setupPyContent = updateSetupPyVersion(setupPyContent, patchRequest.newVersion);
          hasSetupPyChanges = true;
        }

        // Update dependency versions in setup.py
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
    ignore: ["**/node_modules", "**/__pycache__", "**/venv", "**/.venv"],
  });

  const packages = await Promise.all(packageRoots.map((x) => tryLoadPackage(host, root, x)));
  return packages.filter(isDefined);
}

/**
 * Read version from _version.py or version.py file.
 */
async function readVersionFromFile(
  host: ChronusHost,
  root: string,
  relativePath: string,
  packageName: string,
): Promise<string | undefined> {
  const packageFolderPath = packageName.replace(/-/g, "/");
  for (const versionFileName of versionFiles) {
    const versionFilePath = resolvePath(root, relativePath, packageFolderPath, versionFileName);
    if (await isPathAccessible(host, versionFilePath)) {
      const versionFileContent = await host.readFile(versionFilePath);
      const versionMatch = versionFileContent.content.match(/VERSION\s*=\s*["']([^"']+)["']/);
      if (versionMatch) {
        return versionMatch[1];
      }
    }
  }
  return undefined;
}

/**
 * Update version in _version.py or version.py file.
 */
async function updateVersionInFile(
  host: ChronusHost,
  root: string,
  relativePath: string,
  packageName: string,
  newVersion: string,
): Promise<boolean> {
  const packageFolderPath = packageName.replace(/-/g, "/");
  for (const versionFileName of versionFiles) {
    const versionFilePath = resolvePath(root, relativePath, packageFolderPath, versionFileName);
    if (await isPathAccessible(host, versionFilePath)) {
      const versionFile = await host.readFile(versionFilePath);
      const updatedContent = updateVersionFile(versionFile.content, newVersion);
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
  // Try pyproject.toml first - check if it has packaging info in [project] section
  const pyprojectPath = resolvePath(root, relativePath, pyprojectFile);
  if (await isPathAccessible(host, pyprojectPath)) {
    const file = await host.readFile(pyprojectPath);
    const pyprojectToml = parse(file.content) as PyprojectToml;
    
    // PEP 621 format - pyproject.toml used for packaging
    const project = pyprojectToml.project;
    if (project?.name) {
      let version = project.version;
      
      // Check if version is marked as dynamic (Azure SDK pattern)
      const isDynamicVersion = project.dynamic?.includes("version");
      if (isDynamicVersion || !version) {
        version = await readVersionFromFile(host, root, relativePath, project.name);
      }
      
      if (version) {
        return {
          name: project.name,
          version: version,
          relativePath: relativePath,
          dependencies: new Map([
            ...parseDependencies(project.dependencies, "prod"),
            ...(project["optional-dependencies"]
              ? Object.values(project["optional-dependencies"]).flatMap((deps) => parseDependencies(deps, "dev"))
              : []),
          ]),
        };
      }
    }
    // If pyproject.toml exists but doesn't have [project] section with name/version,
    // it's likely being used for tools only, so fall through to check setup.py
  }
  
  // Try setup.py - either pyproject.toml doesn't exist, or it's only used for tools
  const setupPyPath = resolvePath(root, relativePath, setupPyFile);
  if (await isPathAccessible(host, setupPyPath)) {
    const file = await host.readFile(setupPyPath);
    const packageInfo = parseSetupPy(file.content);
    
    // If version is in a separate file (_version.py or version.py), read it
    let version = packageInfo.version;
    if (!version && packageInfo.versionFile && packageInfo.name) {
      version = await readVersionFromFile(host, root, relativePath, packageInfo.name);
    }
    
    if (packageInfo.name && version) {
      return {
        name: packageInfo.name,
        version: version,
        relativePath: relativePath,
        dependencies: new Map([
          ...parseDependencies(packageInfo.install_requires, "prod"),
          ...parseDependencies(packageInfo.extras_require?.dev, "dev"),
        ]),
      };
    }
  }
  
  return undefined;
}

/**
 * Parse Python dependency specifications from string arrays.
 * Handles formats like "package>=1.0.0" or "package[extra]>=1.0.0".
 */
function parseDependencies(deps: string[] | undefined, kind: "prod" | "dev"): [string, PackageDependencySpec][] {
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
  versionFile?: string; // Path to _version.py or version.py if version is imported from there
  install_requires?: string[];
  extras_require?: Record<string, string[]>;
}

/**
 * Parse setup.py to extract package information.
 * Supports both standard setup() calls and Azure SDK patterns.
 */
function parseSetupPy(content: string): SetupPyInfo {
  const info: SetupPyInfo = {};
  
  // Extract name - check for both direct assignment and PACKAGE_NAME variable (Azure SDK)
  const directNameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
  const packageNameMatch = content.match(/PACKAGE_NAME\s*=\s*["']([^"']+)["']/);
  info.name = directNameMatch?.[1] ?? packageNameMatch?.[1];
  
  // Check if version is imported from a separate file (Azure SDK pattern)
  // Detects patterns like: with open(...'_version.py'...) or with open(...'version.py'...)
  // Prefer _version.py if both are mentioned (more common in Azure SDK)
  if (content.includes("with open")) {
    const versionFileMatches = content.match(/["']((?:_)?version\.py)["']/g);
    if (versionFileMatches) {
      const preferredFile = versionFileMatches.find(m => m.includes("_version.py")) ?? versionFileMatches[0];
      info.versionFile = preferredFile.replace(/["']/g, "");
    }
  }
  
  // Extract version directly from setup.py
  info.version = content.match(/version\s*=\s*["']([^"']+)["']/)?.[1];
  
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

/**
 * Update the VERSION variable in _version.py or version.py files
 */
function updateVersionFile(content: string, newVersion: string): string {
  return content.replace(/VERSION\s*=\s*["']([^"']+)["']/, `VERSION = "${newVersion}"`);
}
