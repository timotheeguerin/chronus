# Chronus Github Plugin

This plugin is used to integrate Chronus with Github.

Provides the following functionalities:

### Github enhanced changelog

The changelog entries will link back to the pr that added them.

Add this to `.chronus/config.yaml`

```yaml
changelog: ["@chronus/github/changelog", { repo: "<user>/<repo>" }]
```

Result example:

```md
## 0.16.0

### Bug Fixes

- [#365](https://github.com/timotheeguerin/chronus/pull/365) Fix `--exclude` not respected for `version`, `status` commands

### Features

- [#367](https://github.com/timotheeguerin/chronus/pull/367) Reverse order of change kinds in changelog. As changes are recommneded to be ordered from least disruptive to most in the config.
```

### Create Github comment

Command that generate a comment that lets you know what changes are in the PR and gives a link to add the changelog directly in the browser.

```bash
chronus-github get-pr-comment --out ./comment-out/comment.json
```

**This must be used with the `@chronus/github-pr-commenter` package to then publish it in a 2 step process as described by github https://securitylab.github.com/research/github-actions-preventing-pwn-requests/**

### Create Github release

Create a github release from the publish summary extracting back the changelog from changelog.md.

```bash
# Chronus publish the package and create a release summary
chronus publish --access public --report-summary ./publish-summary.json
# Chronus github uses the summary to create the github release
chronus-github create-releases --repo <user>/<name> --publish-summary ./publish-summary.json
```
