// @ts-check
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { referenceSidebar } from "./src/generated/reference/sidebar.ts";
import rehypeExternalLinks from "./src/lib/rehype-external-links.ts";
import { gmtReferenceWatch } from "./src/lib/gmt-reference-watch.ts";

// DOX-A2 deploys to Cloudflare Workers' default *.workers.dev subdomain (no
// custom domain yet). `site` must be set or @astrojs/sitemap (a Starlight
// dependency) warns on every build.
const SITE = "https://gmt-dox.northguild.workers.dev";

const gmtPkg = fileURLToPath(
  new URL("../../packages/gmt/dist", import.meta.url),
);

export default defineConfig({
  site: SITE,
  markdown: {
    // External links in Markdown and MDX open in a new tab, like ButtonLink's do.
    rehypePlugins: [rehypeExternalLinks],
  },
  vite: {
    server: {
      // DOX-C3a (#139): `/api/chat` lives in the Cloudflare Worker, which
      // `astro dev` doesn't run — it only serves the static site, so the chat
      // 404s here. Proxying that one route to a local `wrangler dev` gives a
      // single URL with both: hot reload for the UI *and* a real backend.
      // Everything else is still served by Astro, so this changes nothing for
      // any other page. `pnpm dev` starts both; see package.json.
      proxy: {
        "/api": {
          target: "http://localhost:8787",
          changeOrigin: true,
        },
      },
    },
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Astro points Vite's startup dependency scan at .jsx/.tsx/.vue/.svelte/
      // .html only. Every widget, chart and globe is an .astro <script> into a
      // plain .ts module under src/lib, so their packages (@tanstack/charts,
      // d3-geo, topojson-client, …) were discovered only when a page first
      // imported them. Vite then re-bundled and force-reloaded every open page,
      // and any dynamic import in flight — a widget's chunk — failed with
      // "Failed to fetch dynamically imported module" (seen 2026-09-24). Scanning
      // src/lib finds them at startup instead. Tests and the server-only
      // retrieval modules are left out; they never reach a browser.
      entries: [
        "src/lib/**/*.ts",
        "!src/lib/**/*.test.ts",
        "!src/lib/retrieval/**",
      ],
    },
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
    // Dev only (its hook is `astro:server:setup`): regenerates the API reference
    // when gmt source changes, so a JSDoc edit shows up without a restart.
    gmtReferenceWatch(),
    react(),
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
        {
          icon: "discord",
          label: "Discord",
          href: "https://discord.gg/TdvQdP3t5a",
        },
      ],
      // The Dox crystal, hand-authored in public/favicon.svg. Without this
      // Starlight falls back to its own default of '/favicon.svg' — a file
      // that did not exist, so every page in the site was requesting it and
      // being served the 404 page. The PNG fallbacks, for browsers that
      // cannot use an SVG icon, are in `head` below.
      favicon: "/favicon.svg",
      // Inline the code-block styles instead of linking `ec.<hash>.css`.
      // Expressive Code emits that <link> inside <body>, at the first code
      // block, and the browser holds back everything after an in-body
      // stylesheet until it has loaded — so on each route change the page
      // painted with an empty gap below the first heading for a frame. An
      // inline <style> applies as it is parsed. Costs ~4 KB gzipped per page.
      expressiveCode: { emitExternalStylesheet: false },
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
        // Hold the first paint until the end-of-page marker (src/components/
        // Footer.astro) is parsed. On a route change the browser keeps showing
        // the old page until the new one first paints; without this that
        // happens mid-parse, so the header, sidebar and content appear in
        // separate frames — the "flash". Browsers without `rel="expect"`
        // ignore it, and blocking always ends when parsing finishes, so a
        // page without the marker still renders.
        // https://html.spec.whatwg.org/multipage/links.html#link-type-expect
        {
          tag: "link",
          attrs: {
            rel: "expect",
            href: "#gmt-page-end",
            blocking: "render",
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
        /* Raster fallbacks for the SVG favicon above, generated from it by
           `pnpm run favicons`. Starlight sorts its own `rel="shortcut icon"`
           entry *after* extra icon links precisely so the SVG wins wherever
           it is supported (see its utils/head.ts), which makes this the
           fallback rather than the winner. Rendered at the exact size the
           browser asks for, so falling back never means downscaling. */
        {
          tag: "link",
          attrs: {
            rel: "icon",
            type: "image/png",
            sizes: "32x32",
            href: "/favicon-32.png",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "apple-touch-icon",
            sizes: "180x180",
            href: "/apple-touch-icon.png",
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
      /* Every group starts collapsed. Starlight still opens any group that
         contains the current page (SidebarSublist: open when an entry is
         current or the group is not collapsed), so a page opens only its own
         ancestors. */
      sidebar: [
        {
          label: "Start here",
          collapsed: true,
          items: [
            { slug: "why-gmt" },
            { slug: "upstream" },
            { slug: "core-rules" },
            { slug: "install" },
          ],
        },
        { label: "API Reference", collapsed: true, items: referenceSidebar },
        {
          label: "Guides",
          collapsed: true,
          items: [{ autogenerate: { directory: "guides", collapsed: true } }],
        },
        {
          label: "Tools",
          collapsed: true,
          items: [{ autogenerate: { directory: "tools", collapsed: true } }],
        },
        {
          label: "Scenarios",
          collapsed: true,
          items: [
            { autogenerate: { directory: "scenarios", collapsed: true } },
          ],
        },
        {
          label: "Mistakes",
          collapsed: true,
          items: [{ autogenerate: { directory: "mistakes", collapsed: true } }],
        },
      ],
      components: {
        Head: "./src/components/Head.astro",
        Header: "./src/components/Header.astro",
        Footer: "./src/components/Footer.astro",
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
        "./src/styles/gmt-playground.css", // mistake component styles
        "./src/styles/gmt-form-controls.css", // shared label/input/select styles
        "./src/styles/gmt-widget.css", // shared teaching-widget chrome (card/section/codeframe/output)
        "./src/styles/gmt-dst-inspector.css", // DST Transition Inspector widget (DOX-B2b)
        "./src/styles/gmt-interval-visualizer.css", // Interval Algebra Visualizer widget (DOX-B2c)
        "./src/styles/gmt-dwell-ledger.css", // Dwell Ledger widget (TRAN-8)
        "./src/styles/gmt-free-time-ledger.css", // Free Time Ledger widget (INT-12)
        "./src/styles/gmt-converter-bench.css", // Converter + format bench + regex tester widget
        "./src/styles/gmt-playground-form.css", // form-control playground (POC, chore/136)
        "./src/styles/gmt-charts.css", // chart theme variables + container styles
        "./src/styles/gmt-clock-list.css", // shared .gmt-clock-* row recipe (map, globe)
        "./src/styles/gmt-map.css", // timezone map layout
        "./src/styles/gmt-globe.css", // DOX-E1a interactive globe
        "./src/styles/gmt-scrubber.css", // DOX-E1b multi-zone time scrubber
        "./src/styles/gmt-light.css", // floating [data-theme="light"] overrides
        "./src/styles/gmt-reveal.css", // shared scroll-into-view stagger utility
        "./src/styles/dox.css", // live component layout
        "./src/styles/gmt-upstream.css", // /upstream/ defect table + filings tracker
        "./src/styles/gmt-view-transitions.css", // cross-document route transitions (static header/sidebar, content fade)
        "./src/styles/gmt-a11y.css", // DOX-D1 prefers-reduced-transparency / -contrast / forced-colors — loaded last
      ],
    }),
  ],
});
