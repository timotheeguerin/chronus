import { parse } from "smol-toml";
import { ChronusError } from "../../utils/errors.js";
import { isPathAccessible } from "../../utils/fs-utils.js";
import type { ChronusHost } from "../../utils/host.js";
import { isDefined } from "../../utils/misc-utils.js";
import { joinPaths, resolvePath } from "../../utils/path-utils.js";
import type { Package, PackageDependencySpec, PatchPackageVersion, Workspace, WorkspaceManager } from "../types.js";

const pyprojectFile = "pyproject.toml";

export interface PyprojectToml {
  "tool"?: {
    poetry?: {
      name?: string;
      version?: string;
      dependencies?: Record<string, PyprojectDependency>;
      "dev-dependencies"?: Record<string, PyprojectDependency>;
      group?: Record<string, { dependencies?: Record<string, PyprojectDependency> }>;
    };
  };
  "project"?: {
    name?: string;
    version?: string;
    dependencies?: string[];
    "optional-dependencies"?: Record<string, string[]>;
  };
}

export type PyprojectDependency =
  | string
  | {
      version?: string;
      path?: string;
      optional?: boolean;
      extras?: string[];
    };

export class PoetryWorkspaceManager implements WorkspaceManager {
  type = "python:poetry";
  aliases = ["poetry"];

  async is(host: ChronusHost, dir: string): Promise<boolean> {
    const pyprojectPath = joinPaths(dir, pyprojectFile);
    if (!(await isPathAccessible(host, pyprojectPath))) {
      return false;
    }
    const file = await host.readFile(pyprojectPath);
    const config = parse(file.content) as PyprojectToml;
    return config.tool?.poetry !== undefined;
  }

  async load(host: ChronusHost, root: string): Promise<Workspace> {
    const workspaceFilePath = joinPaths(root, pyprojectFile);
    const file = await host.readFile(workspaceFilePath);
    const config = parse(file.content) as PyprojectToml;
    
    if (config.tool?.poetry === undefined) {
      throw new ChronusError(`tool.poetry entry missing in ${pyprojectFile}`);
    }

    // For Poetry, we need to check if this is a workspace root
    // Poetry doesn't have explicit workspace members like Cargo, so we'll look for a packages directory
    const packages: Package[] = [];
    
    // Try to find packages in common patterns
    const possiblePackageDirs = ["packages/*", "libs/*", "apps/*"];
    
    for (const pattern of possiblePackageDirs) {
      const foundPackages = await findPackagesFromPattern(host, root, pattern);
      packages.push(...foundPackages);
    }

    // If no packages found, check if the root itself is a package
    if (packages.length === 0) {
      const rootPackage = await tryLoadPyprojectToml(host, root, ".");
      if (rootPackage) {
        packages.push(rootPackage);
      }
    }

    return {
      type: "python:poetry",
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
    const pyprojectTomlPath = resolvePath(workspace.path, pkg.relativePath, pyprojectFile);
    const file = await host.readFile(pyprojectTomlPath);
    let content = file.content;

    // Update package version
    if (patchRequest.newVersion) {
      content = updatePackageVersion(content, patchRequest.newVersion);
    }

    // Update dependency versions
    for (const [depName, newVersion] of Object.entries(patchRequest.dependenciesVersions)) {
      content = updateDependencyVersion(content, depName, newVersion);
    }

    await host.writeFile(pyprojectTomlPath, content);
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

  const packages = await Promise.all(packageRoots.map((x) => tryLoadPyprojectToml(host, root, x)));
  return packages.filter(isDefined);
}

export async function tryLoadPyprojectToml(
  host: ChronusHost,
  root: string,
  relativePath: string,
): Promise<Package | undefined> {
  const filepath = resolvePath(root, relativePath, pyprojectFile);
  if (await isPathAccessible(host, filepath)) {
    const file = await host.readFile(filepath);
    const pyprojectToml = parse(file.content) as PyprojectToml;
    
    // Try Poetry format first
    if (pyprojectToml.tool?.poetry) {
      const poetry = pyprojectToml.tool.poetry;
      if (!poetry.name || !poetry.version) {
        throw new ChronusError(`pyproject.toml at ${filepath} is missing tool.poetry.name or tool.poetry.version`);
      }
      return {
        name: poetry.name,
        version: poetry.version,
        relativePath: relativePath,
        dependencies: new Map([
          ...mapPyprojectDependencies(poetry.dependencies, "prod"),
          ...mapPyprojectDependencies(poetry["dev-dependencies"], "dev"),
          // Handle dependency groups (Poetry 1.2+)
          ...(poetry.group
            ? Object.values(poetry.group).flatMap((group) => mapPyprojectDependencies(group.dependencies, "dev"))
            : []),
        ]),
      };
    }
    
    // Try PEP 621 format
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
    
    return undefined;
  } else {
    return undefined;
  }
}

function mapPyprojectDependencies(
  deps: Record<string, PyprojectDependency> | undefined,
  kind: "prod" | "dev",
): [string, PackageDependencySpec][] {
  if (!deps) return [];
  return Object.entries(deps)
    .filter(([name]) => name !== "python") // Skip Python version constraint (not a package dependency)
    .map(([name, dep]) => {
      const version = typeof dep === "string" ? dep : (dep.version ?? dep.path);
      return [
        name,
        {
          name,
          version: version ?? "*",
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

/**
 * Update the package version in [tool.poetry] section.
 * Matches: version = "x.y.z"
 */
function updatePackageVersion(content: string, newVersion: string): string {
  // Match version in [tool.poetry] section
  const poetrySectionRegex = /(\[tool\.poetry\][\s\S]*?)(version\s*=\s*)"([^"]+)"/;
  if (poetrySectionRegex.test(content)) {
    return content.replace(poetrySectionRegex, `$1$2"${newVersion}"`);
  }
  
  // Try PEP 621 format [project] section
  const projectSectionRegex = /(\[project\][\s\S]*?)(version\s*=\s*)"([^"]+)"/;
  return content.replace(projectSectionRegex, `$1$2"${newVersion}"`);
}

/**
 * Update a dependency version. Handles both forms:
 * - Simple: dep = "version"
 * - Object: dep = { version = "...", ... }
 */
function updateDependencyVersion(content: string, depName: string, newVersion: string): string {
  // Escape special regex characters in dependency name
  const escapedName = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Pattern 1: Simple string version - dep = "version"
  const simplePattern = new RegExp(`(^${escapedName}\\s*=\\s*)"([^"]+)"`, "gm");

  // Pattern 2: Inline table with version - dep = { version = "...", ... }
  const inlineTablePattern = new RegExp(`(^${escapedName}\\s*=\\s*\\{[^}]*version\\s*=\\s*)"([^"]+)"`, "gm");

  // Pattern 3: Dotted key section - [*.dependencies.dep] followed by version = "..."
  // This matches TOML sections like [tool.poetry.dependencies.dep] or [tool.poetry.group.dev.dependencies.dep]
  // followed by a version = "..." line within that section
  const dottedKeyPattern = new RegExp(
    `(\\[(?:tool\\.poetry\\.)?(?:dependencies|dev-dependencies|group\\.[^.]+\\.dependencies)\\.${escapedName}\\][^\\[]*version\\s*=\\s*)"([^"]+)"`,
    "gs",
  );

  let result = content;
  result = result.replace(simplePattern, `$1"${newVersion}"`);
  result = result.replace(inlineTablePattern, `$1"${newVersion}"`);
  result = result.replace(dottedKeyPattern, `$1"${newVersion}"`);

  return result;
}
