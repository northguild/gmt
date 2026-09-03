// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { referenceSidebar } from "./src/generated/reference/sidebar.ts";

// DOX-A2 deploys to Cloudflare Workers' default *.workers.dev subdomain (no
// custom domain yet). `site` must be set or @astrojs/sitemap (a Starlight
// dependency) warns on every build.
const SITE = "https://gmt-dox.northguild.workers.dev";

const gmtPkg = fileURLToPath(
  new URL("../../packages/gmt/dist", import.meta.url),
);

export default defineConfig({
  site: SITE,
  vite: {
    build: {
      cssTarget: ["chrome107", "edge107", "firefox104", "safari16"],
      cssMinify: "esbuild",
    },
    resolve: {
      alias: {
        "@northguild/gmt": gmtPkg,
      },
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
          items: [
            { slug: "why-gmt" },
            { slug: "core-rules" },
            { slug: "install" },
          ],
        },
        { label: "API Reference", items: referenceSidebar },
        {
          label: "Guides",
          items: [{ autogenerate: { directory: "guides" } }],
        },
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
        "./src/styles/gmt-motion.css", // DOX-D2: boot, reveal, glitch, scanline
        "./src/styles/gmt-playground.css", // mistake component styles
        "./src/styles/gmt-form-controls.css", // shared label/input/select styles
        "./src/styles/gmt-widget.css", // shared teaching-widget chrome (card/section/codeframe/output)
        "./src/styles/gmt-dst-inspector.css", // DST Transition Inspector widget (DOX-B2b)
        "./src/styles/gmt-interval-visualizer.css", // Interval Algebra Visualizer widget (DOX-B2c)
        "./src/styles/gmt-converter-bench.css", // Converter + format bench + regex tester widget
        "./src/styles/gmt-playground-form.css", // form-control playground (POC, chore/136)
        "./src/styles/gmt-charts.css", // chart theme variables + container styles
        "./src/styles/gmt-map.css", // timezone map layout + clock panel
        "./src/styles/gmt-light.css", // floating [data-theme="light"] overrides
        "./src/styles/dox.css", // live component layout
        "./src/styles/gmt-a11y.css", // DOX-D1 prefers-reduced-transparency / -contrast / forced-colors — loaded last
      ],
    }),
  ],
});
