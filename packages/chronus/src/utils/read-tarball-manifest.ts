import { readFile } from "fs/promises";

import { parseTarGzip } from "nanotar";

export interface TarballManifest {
  readonly _id: string;
  readonly name: string;
  readonly version: string;
  readonly [key: string]: unknown;
}

/** npm packs everything under a `package/` directory. */
const MANIFEST_ENTRY = "package/package.json";

/** Strip a leading `./` that some packers prepend (nanotar already sanitizes paths). */
function normalizeName(name: string): string {
  return name.replace(/^\.\//, "");
}

/**
 * Read `package/package.json` out of an npm `.tgz` tarball.
 *
 * Uses {@link parseTarGzip} from `nanotar` (web-standard `DecompressionStream` + a robust
 * tar parser) to extract only the manifest entry.
 *
 * Replaces the local-tarball behavior of `pacote.manifest(tarballPath)`.
 */
export async function readPackageManifestFromTarball(tarballPath: string): Promise<TarballManifest> {
  const gzipped = await readFile(tarballPath);
  const files = await parseTarGzip(gzipped, {
    filter: (file) => normalizeName(file.name) === MANIFEST_ENTRY,
  });

  const entry = files.find((file) => normalizeName(file.name) === MANIFEST_ENTRY);
  if (entry === undefined) {
    throw new Error(`Could not find \`${MANIFEST_ENTRY}\` in tarball ${tarballPath}.`);
  }

  const manifest = JSON.parse(entry.text);
  return {
    ...manifest,
    _id: `${manifest.name}@${manifest.version}`,
    name: manifest.name,
    version: manifest.version,
  };
}
