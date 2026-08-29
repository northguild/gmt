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
  vite: { build: { cssTarget: ["chrome107","edge107","firefox104","safari16"], cssMinify: "esbuild" } },
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
        {
          label: "Guides",
          items: [{ autogenerate: { directory: "guides" } }],
        },
        { label: "Reference", items: referenceSidebar },
        {
          label: "Scenarios",
          items: [{ autogenerate: { directory: "scenarios" } }],
        },
        {
          label: "Mistakes",
          items: [{ autogenerate: { directory: "mistakes" } }],
        },
      ],
      components: {
        ThemeProvider: "./src/components/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
        Hero: "./src/components/Hero.astro",
        SocialIcons: "./src/components/SocialIcons.astro",
      },
      customCss: [
        "./src/styles/gmt-tokens.css", // palette + --gmt-* tokens, @font-face
        "./src/styles/gmt-theme.css", // --gmt-* mapped onto Starlight's --sl-*
        "./src/styles/gmt-primitives.css", // reusable .gmt-glass* / .gmt-icon-button
        "./src/styles/gmt-glass.css", // glass treatment on Starlight elements
        "./src/styles/gmt-shell.css", // typography + layout frame
        "./src/styles/gmt-content.css", // .sl-markdown-content + EC + search
        "./src/styles/gmt-controls.css", // buttons, focus, selection, scrollbar
        "./src/styles/gmt-playground.css", // live playground island (DOX-B1a)
        "./src/styles/gmt-light.css", // floating [data-theme="light"] overrides
      ],
    }),
  ],
});
