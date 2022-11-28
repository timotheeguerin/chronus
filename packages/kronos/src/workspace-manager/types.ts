export interface Workspace {
  path: string;
  packages: Package[];
}

export interface Package {
  /**
   * Package name
   */
  name: string;

  /**
   * Package version
   */
  version: string;

  /**
   * Relative path to the workspace root.
   */
  relativePath: string;
}

export interface WorkspaceManager {
  load(dir: string): Promise<Workspace>;
}
