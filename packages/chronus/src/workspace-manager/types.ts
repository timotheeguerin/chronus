import type { ChronusHost } from "../utils/host.js";

export interface PackageId {
  /** Package name */
  readonly name: string;
  /** Package version */
  readonly version: string;
}
export interface PackageBase extends PackageId {
  /** Ecosystem for this package */
  readonly ecosystem: string;
  /** If package is private */
  readonly private?: boolean;

  /** Dependencies for this package */
  readonly dependencies: Map<string, PackageDependencySpec>;
}

export interface PackageDependencySpec {
  /** Dependency name */
  readonly name: string;

  /** Dependency version */
  readonly version: string;

  /** Dependency kind */
  readonly kind: "prod" | "dev";
}

export interface Package extends PackageBase {
  /** Relative path of the package to the chronus workspace root */
  readonly relativePath: string;
}

export interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly dependencies?: { [key: string]: string };
  readonly peerDependencies?: { [key: string]: string };
  readonly devDependencies?: { [key: string]: string };
  readonly optionalDependencies?: { [key: string]: string };
  readonly workspaces?: string[];
}

export interface PatchPackageVersion {
  newVersion?: string;
  dependenciesVersions: Record<string, string>;
}

export interface Ecosystem {
  type: string;
  aliases?: string[];
  is(host: ChronusHost, dir: string): Promise<boolean>;
  loadPattern(host: ChronusHost, workspaceRoot: string, pattern: string): Promise<Package[]>;
  load(host: ChronusHost, dir: string): Promise<Package[]>;
  updateVersionsForPackage(
    host: ChronusHost,
    workspaceRoot: string,
    pkg: Package,
    patchRequest: PatchPackageVersion,
  ): Promise<void>;
}
