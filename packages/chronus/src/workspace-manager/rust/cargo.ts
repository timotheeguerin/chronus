import { parse } from "smol-toml";
import { ChronusError } from "../../utils/errors.js";
import { isPathAccessible } from "../../utils/fs-utils.js";
import type { ChronusHost } from "../../utils/host.js";
import { isDefined } from "../../utils/misc-utils.js";
import { joinPaths, resolvePath } from "../../utils/path-utils.js";
import type { Package, PackageDependencySpec, PatchPackageVersion, Workspace, WorkspaceManager } from "../types.js";

const cargoFile = "Cargo.toml";

export interface CargoToml {
  "package"?: {
    name?: string;
    version?: string;
  };
  "workspace"?: {
    resolver?: string;
    members?: string[];
    exclude?: string[];
  };
  "dependencies"?: Record<string, CargoDependency>;
  "dev-dependencies"?: Record<string, CargoDependency>;
  "build-dependencies"?: Record<string, CargoDependency>;
}

export type CargoDependency =
  | string
  | {
      version?: string;
      path?: string;
      optional?: boolean;
      features?: string[];
    };

export class CargoWorkspaceManager implements WorkspaceManager {
  type = "rust:cargo";
  aliases = ["cargo"];

  async is(host: ChronusHost, dir: string): Promise<boolean> {
    return isPathAccessible(host, joinPaths(dir, cargoFile));
  }

  async load(host: ChronusHost, root: string): Promise<Workspace> {
    const workspaceFilePath = joinPaths(root, cargoFile);
    const file = await host.readFile(workspaceFilePath);
    const config = parse(file.content) as CargoToml;
    if (config.workspace === undefined) {
      throw new ChronusError(`workspace entry missing in ${cargoFile}`);
    }
    if (!config.workspace.members) {
      throw new ChronusError(`workspace.members entry missing in ${cargoFile}`);
    }
    // Parse the Cargo.toml to find packages
    const packages: Package[] = await findCratesFromPattern(host, root, [
      ...config.workspace.members,
      ...(config.workspace.exclude || []).map((x) => `!${x}`),
    ]);

    return {
      type: "rust:cargo",
      path: root,
      packages,
    };
  }

  updateVersionsForPackage(
    host: ChronusHost,
    workspace: Workspace,
    pkg: Package,
    patchRequest: PatchPackageVersion,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export async function findCratesFromPattern(
  host: ChronusHost,
  root: string,
  pattern: string | string[],
): Promise<Package[]> {
  const packageRoots = await host.glob(pattern, {
    baseDir: root,
    onlyDirectories: true,
    ignore: ["**/node_modules"],
  });

  const packages = await Promise.all(packageRoots.map((x) => tryLoadCargoToml(host, root, x)));
  return packages.filter(isDefined);
}

export async function tryLoadCargoToml(
  host: ChronusHost,
  root: string,
  relativePath: string,
): Promise<Package | undefined> {
  const filepath = resolvePath(root, relativePath, cargoFile);
  if (await isPathAccessible(host, filepath)) {
    const file = await host.readFile(filepath);
    const cargoToml = parse(file.content) as CargoToml;
    if (cargoToml.package === undefined) {
      return undefined;
    }
    if (!cargoToml.package.name || !cargoToml.package.version) {
      throw new ChronusError(`Cargo.toml at ${filepath} is missing package name or version`);
    }
    return {
      name: cargoToml.package.name,
      version: cargoToml.package.version,
      relativePath: relativePath,
      dependencies: new Map([
        ...mapCargoDependencies(cargoToml.dependencies, "prod"),
        ...mapCargoDependencies(cargoToml["dev-dependencies"], "dev"),
        ...mapCargoDependencies(cargoToml["build-dependencies"], "dev"),
      ]),
    };
  } else {
    return undefined;
  }
}

function mapCargoDependencies(
  deps: Record<string, CargoDependency> | undefined,
  kind: "prod" | "dev",
): [string, PackageDependencySpec][] {
  if (!deps) return [];
  return Object.entries(deps).map(([name, dep]) => {
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
