export type ReleaseConfig = PackageRelease | PolicyRelease;
export interface PackageRelease {
  readonly kind: "package";
  readonly packageName: string;
  readonly version: string;
}

export interface PolicyRelease {
  readonly packageName: string;
  readonly version: string;
}

// export async function createGithubRelease(octokit: any) {
//   await octokit.rest.repos.createRelease({
//     name: tagName,
//     tag_name: tagName,
//     body: changelogEntry.content,
//     ...github.context.repo,
//   });
// }
