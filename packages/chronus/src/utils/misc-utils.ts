import type { ChronusPackage } from "../workspace/types.js";

export function isDefined<T>(arg: T | undefined): arg is T {
  return arg !== undefined;
}

const UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

/**
 * Format a number of bytes by addding KB, MB, GB, etc. after
 * @param bytes Number of bytes to prettify
 * @param perecision Number of decimals to keep. @default 2
 */
export function prettyBytes(bytes: number, decimals = 2) {
  if (!Number.isFinite(bytes)) {
    throw new TypeError(`Expected a finite number, got ${typeof bytes}: ${bytes}`);
  }

  const neg = bytes < 0;

  if (neg) {
    bytes = -bytes;
  }

  if (bytes < 1) {
    return (neg ? "-" : "") + bytes + " B";
  }

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), UNITS.length - 1);
  const numStr = Number((bytes / Math.pow(1000, exponent)).toFixed(decimals));
  const unit = UNITS[exponent];

  return (neg ? "-" : "") + numStr + " " + unit;
}

export function getLastJsonObject(str: string) {
  let end = str.length - 1;
  for (let i = str.length - 1; i >= 0; i--) {
    if (str[i] === "}") {
      end = i;
      break;
    }
  }

  for (let i = end; i >= 0; i--) {
    if (str[i] === "{") {
      try {
        return JSON.parse(str.slice(i, end + 1));
      } catch (err) {
        // ignore keep trying to look for previous { to parse
      }
    }
  }
  return null;
}

/**
 * Whether a package should be versioned (i.e. get its version bumped in package.json).
 * `versioned` and `standalone` packages are always versioned. A `private` package is
 * normally left untouched, but if it is explicitly listed in a version policy the user
 * clearly wants it versioned as part of that group (it is still never published).
 */
export function isPackageVersioned(pkg: ChronusPackage): boolean {
  if (pkg.state === "versioned" || pkg.state === "standalone") {
    return true;
  }
  if (pkg.state === "private" && pkg.policy.packages.includes(pkg.name)) {
    return true;
  }
  return false;
}

export function isPackageIncluded(
  pkg: ChronusPackage,
  { only, exclude }: { only?: string[]; exclude?: string[] },
): boolean {
  const pkgName = pkg.name;
  const policyName = pkg.policy.name;

  if (exclude && (exclude.includes(pkgName) || exclude.includes(policyName))) {
    return false;
  }

  if (only) {
    return only.includes(pkgName) || only.includes(policyName);
  }

  return true;
}
