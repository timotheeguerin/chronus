import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://timotheeguerin.github.io",
  base: "/chronus",
  integrations: [
    starlight({
      title: "Chronus",
      description: "Changelog management for monorepos",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/timotheeguerin/chronus",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/timotheeguerin/chronus/edit/main/packages/website/",
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [{ label: "Installation", slug: "getting-started/installation" }],
        },
        {
          label: "Guides",
          items: [
            { label: "Change Kinds", slug: "guides/change-kinds" },
            { label: "Changed Files Filter", slug: "guides/changed-files-filter" },
            { label: "Changelog Generator", slug: "guides/changelog-generator" },
            { label: "Prereleases", slug: "guides/prerelease" },
            { label: "Supported Environments", slug: "guides/supported-environments" },
            { label: "Version Policies", slug: "guides/version-policies" },
          ],
        },
        {
          label: "Reference",
          items: [{ label: "CLI", slug: "reference/cli" }],
        },
      ],
    }),
  ],
});
