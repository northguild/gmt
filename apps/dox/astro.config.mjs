// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// DOX-A2 deploys to Cloudflare Workers' default *.workers.dev subdomain (no
// custom domain yet). `site` must be set or @astrojs/sitemap (a Starlight
// dependency) warns on every build.
const SITE = "https://gmt-dox.northguild.workers.dev";

export default defineConfig({
  site: SITE,
  integrations: [
    starlight({
      title: "@northguild/gmt",
      description:
        "Temporal-first date and time utilities with timezone support and polyfill integration.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/northguild/gmt",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/northguild/gmt/edit/main/apps/dox/",
      },
      sidebar: [
        {
          label: "Start here",
          items: [{ slug: "install" }, { slug: "core-rules" }],
        },
      ],
    }),
  ],
});
