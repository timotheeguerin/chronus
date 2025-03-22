# Chronus github pr commenter

Package to be used with `@chronus/github` to comment on PRs with the changelog.

This has to be used in a 2 step process as described by github [here](https://securitylab.github.com/research/github-actions-preventing-pwn-requests/).

Pr workflow checking for changes and creating a comment:

```yaml
name: Check Changes

on:
  pull_request:
    branches:
      - main

permissions:
  pull-requests: write

jobs:
  changes:
    if: ${{ github.actor != 'dependabot[bot]' && !startsWith(github.head_ref, 'publish/') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 ## Needed for changelog
      - uses: ./.github/actions/setup

      - uses: pnpm/action-setup@v3
        name: Install pnpm

      - run: pnpm install
        name: Install dependencies

      - name: Create PR Comment
        run: pnpm chronus-github get-pr-comment --out ./comment-out/comment.json
        env:
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}

      - uses: actions/upload-artifact@v4
        with:
          name: comment
          path: comment-out/
          retention-days: 1 # Only need for the next workflow so don't need to waste storageretention-days

      - run: pnpm chronus verify
        name: Verify changes
```

Workflow writing the comment on the PR from the other workflow artifact

```yaml
name: Make Change Comment

on:
  workflow_run:
    workflows: ["Changes"]
    types:
      - completed

permissions:
  pull-requests: write

jobs:
  # DO NOT BUILD ANYTHING FROM A PR HERE https://securitylab.github.com/research/github-actions-preventing-pwn-requests/
  commenter:
    if: >
      github.event.workflow_run.event == 'pull_request' &&
      github.actor != 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: comment
          run-id: ${{github.event.workflow_run.id }}
          github-token: ${{secrets.GITHUB_TOKEN}}
      - name: Display structure of downloaded files
        run: ls -R

      - uses: ./.github/actions/setup

      - run: pnpm install
        name: Install dependencies

      - run: pnpm chronus-github-pr-commenter --comment-file comment.json
        env:
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
        name: Create/update comment
```
