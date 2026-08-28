// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { referenceSidebar } from "./src/generated/reference/sidebar.ts";

// DOX-A2 deploys to Cloudflare Workers' default *.workers.dev subdomain (no
// custom domain yet). `site` must be set or @astrojs/sitemap (a Starlight
// dependency) warns on every build.
const SITE = "https://gmt-dox.northguild.workers.dev";

export default defineConfig({
  site: SITE,
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      wrap: false,
    },
  },
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
      // Preload the self-hosted display font (vendored to `public/fonts/`, see
      // gmt-tokens.css). Without this the browser only discovers the @font-face
      // after the CSS bundle parses, so the site title and every heading
      // reflow out of the mono fallback on each navigation — the "header flash".
      head: [
        {
          tag: "link",
          attrs: {
            rel: "preload",
            href: "/fonts/michroma-latin-400-normal.woff2",
            as: "font",
            type: "font/woff2",
            crossorigin: "anonymous",
          },
        },
        // DOX-A3b: discoverability — let LLMs find the llms.txt surface
        {
          tag: "link",
          attrs: {
            rel: "alternate",
            type: "text/plain",
            href: "/llms.txt",
          },
        },
        {
          tag: "script",
          content: `(() => {
            const el = document.documentElement;
            el.classList.add('is-scrolling');
            let t;
            const end = () => {
              clearTimeout(t);
              t = setTimeout(() => el.classList.remove('is-scrolling'), 500);
            };
            window.addEventListener('scroll', end, { passive: true });
          })();`,
        },
      ],
      sidebar: [
        {
          label: "Start here",
          items: [{ slug: "install" }, { slug: "core-rules" }],
        },
        { label: "Reference", items: referenceSidebar },
      ],
      components: {
        ThemeProvider: "./src/components/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
        PageTitle: "./src/components/PageTitle.astro",
        Hero: "./src/components/Hero.astro",
      },
      customCss: [
        "./src/styles/gmt-tokens.css",
        "./src/styles/gmt-glass.css",
        "./src/styles/gmt-site.css",
      ],
    }),
  ],
});
