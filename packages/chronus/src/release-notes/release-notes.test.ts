import { describe, expect, it } from "vitest";
import { renderContextAsMarkdown } from "./collect-context.js";
import { renderPrompt } from "./render-prompt.js";
import type { ReleaseNotesContext } from "./types.js";

describe("renderContextAsMarkdown", () => {
  it("renders a basic context with changes grouped by kind and package", () => {
    const context: ReleaseNotesContext = {
      version: "2.0.0",
      releaseDate: "2026-06-09",
      packages: ["pkg-a", "pkg-b"],
      changesByKind: {
        breaking: [{ id: "c1", content: "Removed deprecated API", packages: ["pkg-a"], changeKind: "breaking" }],
        feature: [
          { id: "c2", content: "Added new helper", packages: ["pkg-b"], changeKind: "feature" },
          { id: "c3", content: "Support async operations", packages: ["pkg-a", "pkg-b"], changeKind: "feature" },
        ],
      },
      enrichments: {},
    };

    const result = renderContextAsMarkdown(context);

    expect(result).toContain("# Release Notes Context");
    expect(result).toContain("**Version:** 2.0.0");
    expect(result).toContain("**Release Date:** 2026-06-09");
    expect(result).toContain("**Packages:** pkg-a, pkg-b");
    expect(result).toContain("### breaking");
    expect(result).toContain("#### pkg-a");
    expect(result).toContain("- Removed deprecated API");
    expect(result).toContain("### feature");
    expect(result).toContain("#### pkg-b");
    expect(result).toContain("- Added new helper");
    expect(result).toContain("#### pkg-a, pkg-b");
    expect(result).toContain("- Support async operations");
  });

  it("includes PR links when metadata provides them", () => {
    const context: ReleaseNotesContext = {
      packages: ["pkg-a"],
      changesByKind: {
        feature: [
          {
            id: "c1",
            content: "New feature",
            packages: ["pkg-a"],
            changeKind: "feature",
            metadata: { prNumber: 42, prUrl: "https://github.com/test/repo/pull/42" },
          },
        ],
      },
      enrichments: {},
    };

    const result = renderContextAsMarkdown(context);
    expect(result).toContain("[#42](https://github.com/test/repo/pull/42) New feature");
  });
});

describe("renderPrompt", () => {
  it("replaces template variables with context data", () => {
    const template =
      "Version: {{version}}\nSlug: {{slug}}\nPackages: {{packages}}\nDate: {{releaseDate}}\n\n{{context}}";
    const context: ReleaseNotesContext = {
      version: "3.0.0",
      releaseDate: "2026-06-09",
      packages: ["my-pkg"],
      changesByKind: {
        fix: [{ id: "c1", content: "Fixed a bug", packages: ["my-pkg"], changeKind: "fix" }],
      },
      enrichments: {},
    };

    const result = renderPrompt(template, context);

    expect(result).toContain("Version: 3.0.0");
    expect(result).toContain("Slug: 3-0-0");
    expect(result).toContain("Packages: my-pkg");
    expect(result).toContain("Date: 2026-06-09");
    expect(result).toContain("### fix");
    expect(result).toContain("- Fixed a bug");
  });

  it("handles missing optional fields gracefully", () => {
    const template = "v{{version}} ({{releaseDate}}) policy={{policy}}";
    const context: ReleaseNotesContext = {
      packages: ["a"],
      changesByKind: {},
      enrichments: {},
    };

    const result = renderPrompt(template, context);
    expect(result).toBe("vunreleased (TBD) policy=");
  });
});
