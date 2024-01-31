export type WorkspaceType = "npm" | "pnpm" | "rush";
export interface Workspace {
  readonly type: WorkspaceType;
  readonly path: string;
  readonly packages: Package[];
}

export interface Package {
  /** Package name */
  readonly name: string;

  /** Relative path of the package to the workspace root */
  readonly relativePath: string;

  /** Package version */
  readonly version: string;

  readonly manifest: PackageJson;
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

export interface WorkspaceManager {
  type: WorkspaceType;
  is(dir: string): Promise<boolean>;
  load(dir: string): Promise<Workspace>;
}
