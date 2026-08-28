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
      editLink: {
        baseUrl: "https://github.com/northguild/gmt/edit/main/apps/dox/",
      },
      // Preload the self-hosted display font (vendored to `public/fonts/`, see
      // mg-theme.css). Without this the browser only discovers the @font-face
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
        {
          tag: "script",
          content: `(() => {
            const mq = window.matchMedia('(min-width: 50rem)');
            const syncSidebar = () => {
              const sidebar = document.querySelector('.sidebar-pane');
              const html = document.documentElement;
              if (sidebar && html.hasAttribute('data-has-sidebar') && mq.matches) {
                html.style.setProperty('--sl-content-inline-start', Math.ceil(sidebar.getBoundingClientRect().width) + 'px');
              } else {
                html.style.removeProperty('--sl-content-inline-start');
              }
            };
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', syncSidebar);
            } else {
              syncSidebar();
            }
            mq.addEventListener('change', syncSidebar);
            window.addEventListener('resize', syncSidebar);
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
        SocialIcons: "./src/components/SocialIcons.astro",
        ThemeProvider: "./src/components/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
        PageTitle: "./src/components/PageTitle.astro",
      },
      customCss: [
        "./src/styles/mg-theme.css",
        "./src/styles/mg-glass.css",
        "./src/styles/mg-site.css",
      ],
    }),
  ],
});
