export const DEFAULT_REGISTRY = "https://registry.npmjs.org";

export interface FetchPackageManifestOptions {
  /** Registry to fetch the package from. Defaults to {@link DEFAULT_REGISTRY}. */
  readonly registry?: string;
}

export interface RegistryManifestDist {
  readonly tarball: string;
  readonly unpackedSize?: number;
  readonly [key: string]: unknown;
}

/** A single version manifest as resolved from a registry packument. */
export interface RegistryManifest {
  readonly _id: string;
  readonly name: string;
  readonly version: string;
  /** Resolved tarball url(matches the `_resolved` field pacote produces). */
  readonly _resolved: string;
  readonly dist: RegistryManifestDist;
  readonly [key: string]: unknown;
}

export type RegistryErrorCode = "E404" | "ETARGET";

/** Error thrown when a package or version cannot be resolved from the registry. */
export class RegistryError extends Error {
  readonly code: RegistryErrorCode;
  /** Only set for ETARGET errors. */
  readonly type?: "version";

  constructor(code: RegistryErrorCode, message: string, type?: "version") {
    super(message);
    this.code = code;
    this.type = type;
    this.name = "RegistryError";
  }
}

interface Packument {
  readonly name: string;
  readonly "dist-tags"?: Record<string, string>;
  readonly versions: Record<string, RegistryManifest>;
}

interface ParsedSpec {
  readonly name: string;
  /** A version or a dist-tag. Defaults to `latest`. */
  readonly selector: string;
}

function parseSpec(spec: string): ParsedSpec {
  // Scoped packages start with `@scope/name`; the version separator is the last `@`.
  const scoped = spec.startsWith("@");
  const lastAt = spec.lastIndexOf("@");
  if (lastAt > 0 && !(scoped && lastAt === 0)) {
    return { name: spec.slice(0, lastAt), selector: spec.slice(lastAt + 1) || "latest" };
  }
  return { name: spec, selector: "latest" };
}

function packumentUrl(registry: string, name: string): string {
  const base = registry.endsWith("/") ? registry.slice(0, -1) : registry;
  // Encode the name but keep the scope slash unescaped (`@scope/name`).
  const encoded = name.startsWith("@") ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
  return `${base}/${encoded}`;
}

/**
 * Fetch a package version manifest from an npm registry.
 *
 * Replaces the registry-fetching behavior of `pacote.manifest(spec)`. Supports resolving
 * by exact version or by dist-tag (e.g. `latest`, `next`).
 *
 * @param spec Package spec such as `name`, `name@1.0.0` or `name@tag`.
 */
export async function fetchPackageManifest(
  spec: string,
  options: FetchPackageManifestOptions = {},
): Promise<RegistryManifest> {
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const { name, selector } = parseSpec(spec);

  const response = await fetch(packumentUrl(registry, name));
  if (response.status === 404) {
    throw new RegistryError("E404", `Package \`${name}\` not found in registry ${registry}.`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch \`${name}\` from registry ${registry}: ${response.status} ${response.statusText}`);
  }

  const packument = (await response.json()) as Packument;
  const version = packument["dist-tags"]?.[selector] ?? selector;
  const manifest = packument.versions?.[version];
  if (manifest === undefined) {
    throw new RegistryError(
      "ETARGET",
      `No matching version found for ${name}@${selector}.`,
      "version",
    );
  }

  return {
    ...manifest,
    _id: manifest._id ?? `${manifest.name}@${manifest.version}`,
    _resolved: manifest.dist?.tarball,
  };
}
