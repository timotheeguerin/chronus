import { graphql } from "@octokit/graphql";

export interface GithubInfo {
  readonly commit: string;
  readonly author: {
    readonly login: string;
    readonly url: string;
  };
  readonly pullRequest?: GithubPrRef;
}

export interface GithubPrRef {
  readonly number: number;
  readonly url: string;
}

export async function getGithubInfoForChange(
  owner: string,
  repo: string,
  commits: Record<string, string>,
  githubToken: string,
): Promise<Record<string, GithubInfo>> {
  const commitQueries = Object.values(commits).map((sha) => {
    return `_${sha}: object(expression: ${JSON.stringify(sha)}) {
      ... on Commit {
        associatedPullRequests(first: 1) {
          nodes {
            number
            url
          }
        }
        author {
          user {
            login
            url
          }
        }
      }
    }`;
  });

  interface QueryResult {
    repo: {
      [key: string]: {
        commitUrl: string;
        associatedPullRequests: {
          nodes: {
            number: number;
            url: string;
          }[];
        };
        author: {
          user: {
            login: string;
            url: string;
          };
        };
      };
    };
  }

  const result: QueryResult = await graphql(
    `
      query commitInfo($owner: String!, $repo: String!) {
        repo: repository(owner: $owner, name: $repo) {
          ${commitQueries.join("\n")}
        }
      }
    `,
    {
      repo,
      owner,
      headers: {
        authorization: `token ${githubToken}`,
      },
    },
  );

  function mapResultToGithubInfo(commit: string): GithubInfo | undefined {
    const info = result.repo[`_${commit}`];
    return {
      commit,
      author: info.author.user,
      pullRequest: info.associatedPullRequests.nodes[0],
    };
  }

  return Object.fromEntries(
    Object.entries(commits)
      .map(([changeId, commit]) => {
        return [changeId, mapResultToGithubInfo(commit)];
      })
      .filter(([, info]) => info !== undefined),
  );
}
