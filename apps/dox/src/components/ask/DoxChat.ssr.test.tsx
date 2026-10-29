/**
 * `/dox` mounts the chat with `client:load`, which means Astro **server-renders**
 * it under Node before hydrating it in the browser. Anything reached during
 * that first render — module top level, a `useMemo` factory, a `useState`
 * initialiser — runs where `window` and `document` do not exist.
 *
 * This test exists because that is exactly how the build was broken once:
 * `window.location.origin` was moved out of a link renderer (called only when a
 * link renders, always on the client) and into the `useMemo` that builds the
 * renderer. Nothing caught it. `astro check` type-checks without rendering, and
 * every other test here either runs in jsdom, where `window` exists, or never
 * renders a component at all. Only `astro build` failed — at the very end of a
 * multi-minute build.
 *
 * Deliberately the `node` environment, with no jsdom docblock and no shims:
 * the absence of DOM globals is the whole point of the test. It checks that the
 * render does not throw. What the server-rendered page shows the reader is read
 * with role queries in `DoxChat.ssr-markup.test.tsx`.
 */
import { renderToString } from "react-dom/server";
import { DoxChat } from "./DoxChat";
import DoxPage from "./DoxPage";
import type { BrainsInfo } from "./use-brains";

const PACIFIC_MIDNIGHT = "2026-06-16T07:00:00Z";

function budget(visitorRemaining: number): BrainsInfo {
  return {
    brains: [
      {
        id: "gemini-3.8-flash",
        label: "3.8 Flash",
        provider: "google",
        remaining: 20,
        limit: 20,
        state: "ok",
      },
    ],
    providers: [{ id: "google", label: "Gemini", resetsAt: PACIFIC_MIDNIGHT }],
    activeBrainId: "gemini-3.8-flash",
    visitor: {
      used: 5 - visitorRemaining,
      limit: 5,
      remaining: visitorRemaining,
      unlimited: false,
      resetsAt: PACIFIC_MIDNIGHT,
    },
  };
}

describe("DoxChat server-side render", () => {
  it("renders without touching a browser global", () => {
    expect(typeof window).toBe("undefined");
    expect(() => renderToString(<DoxChat />)).not.toThrow();
  });

  it("server-renders the examples rail without touching a browser global", () => {
    expect(typeof window).toBe("undefined");
    expect(() => renderToString(<DoxPage />)).not.toThrow();
  });

  it("survives a server render with budget props supplied", () => {
    // The out-of-budget branch renders different markup, and the control bar
    // renders the brain badge; both must be as server-safe as the default.
    expect(() => renderToString(<DoxChat brains={budget(0)} />)).not.toThrow();
    expect(() => renderToString(<DoxChat brains={budget(5)} />)).not.toThrow();
  });
});
