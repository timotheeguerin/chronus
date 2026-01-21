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
    // Include both one-level and two-level nesting for sdk/ to support different repo structures
    const possiblePackageDirs = ["packages/*", "libs/*", "apps/*", "sdk/*", "sdk/*/*"];
    
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
          const packageFolderPath = pkg.name.replace(/-/g, "/");
          for (const versionFileName of versionFiles) {
            const versionFilePath = resolvePath(workspace.path, pkg.relativePath, packageFolderPath, versionFileName);
            if (await isPathAccessible(host, versionFilePath)) {
              const versionFile = await host.readFile(versionFilePath);
              const updatedContent = updateVersionFile(versionFile.content, patchRequest.newVersion);
              await host.writeFile(versionFilePath, updatedContent);
              break;
            }
          }
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
        
        // Check if version is in a separate file (_version.py or version.py)
        if (patchRequest.newVersion && packageInfo.versionFile) {
          const packageFolderPath = pkg.name.replace(/-/g, "/");
          const versionFilePath = resolvePath(workspace.path, pkg.relativePath, packageFolderPath, packageInfo.versionFile);
          if (await isPathAccessible(host, versionFilePath)) {
            const versionFile = await host.readFile(versionFilePath);
            const updatedContent = updateVersionFile(versionFile.content, patchRequest.newVersion);
            await host.writeFile(versionFilePath, updatedContent);
          }
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
        // Try to read version from _version.py or version.py
        const packageFolderPath = project.name.replace(/-/g, "/");
        for (const versionFileName of versionFiles) {
          const versionFilePath = resolvePath(root, relativePath, packageFolderPath, versionFileName);
          if (await isPathAccessible(host, versionFilePath)) {
            const versionFileContent = await host.readFile(versionFilePath);
            const versionMatch = versionFileContent.content.match(/VERSION\s*=\s*["']([^"']+)["']/);
            if (versionMatch) {
              version = versionMatch[1];
              break;
            }
          }
        }
      }
      
      if (version) {
        return {
          name: project.name,
          version: version,
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
      // Convert package name to folder path (e.g., "azure-mgmt-automanage" -> "azure/mgmt/automanage")
      const packageFolderPath = packageInfo.name.replace(/-/g, "/");
      const versionFilePath = resolvePath(root, relativePath, packageFolderPath, packageInfo.versionFile);
      if (await isPathAccessible(host, versionFilePath)) {
        const versionFileContent = await host.readFile(versionFilePath);
        const versionMatch = versionFileContent.content.match(/VERSION\s*=\s*["']([^"']+)["']/);
        if (versionMatch) {
          version = versionMatch[1];
        }
      }
    }
    
    if (packageInfo.name && version) {
      return {
        name: packageInfo.name,
        version: version,
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

function mapPep621Dependencies(deps: string[] | undefined, kind: "prod" | "dev"): [string, PackageDependencySpec][] {
  return mapStringDependencies(deps, kind);
}

function mapSetupPyDependencies(deps: string[] | undefined, kind: "prod" | "dev"): [string, PackageDependencySpec][] {
  return mapStringDependencies(deps, kind);
}

/**
 * Shared helper to parse Python dependency specifications from string arrays
 */
function mapStringDependencies(deps: string[] | undefined, kind: "prod" | "dev"): [string, PackageDependencySpec][] {
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
 * Parse setup.py to extract package information
 */
function parseSetupPy(content: string): SetupPyInfo {
  const info: SetupPyInfo = {};
  
  // Extract name - check for both direct assignment and PACKAGE_NAME variable
  let nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
  if (!nameMatch) {
    // Try to find PACKAGE_NAME = "..." pattern (Azure SDK)
    const packageNameMatch = content.match(/PACKAGE_NAME\s*=\s*["']([^"']+)["']/);
    if (packageNameMatch) {
      info.name = packageNameMatch[1];
    }
  } else {
    info.name = nameMatch[1];
  }
  
  // Check if version is imported from a separate file (Azure SDK pattern)
  // Patterns to detect:
  // 1. with open(os.path.join(package_folder_path, '_version.py'), 'r') as fd:
  // 2. with open(...'_version.py'...) or with open(...'version.py'...)
  // Prefer _version.py if both are mentioned (more common in Azure SDK)
  const versionFileMatches = content.match(/["']((?:_)?version\.py)["']/g);
  if (versionFileMatches && content.includes("with open")) {
    // Look for _version.py first, otherwise use the first match
    const preferredFile = versionFileMatches.find(m => m.includes("_version.py")) || versionFileMatches[0];
    info.versionFile = preferredFile.replace(/["']/g, ""); // Remove quotes
  }
  
  // Extract version directly from setup.py
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

/**
 * Update the VERSION variable in _version.py or version.py files
 */
function updateVersionFile(content: string, newVersion: string): string {
  return content.replace(/VERSION\s*=\s*["']([^"']+)["']/, `VERSION = "${newVersion}"`);
}
