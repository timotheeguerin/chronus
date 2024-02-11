export function updateDependencyVersion(currentVersion: string, newVersion: string): string {
  const currentVersionIsRange = currentVersion.startsWith("^") || currentVersion.startsWith("~");
  if (currentVersionIsRange) {
    return `${currentVersion[0]}${newVersion}`;
  }
  return newVersion;
}
