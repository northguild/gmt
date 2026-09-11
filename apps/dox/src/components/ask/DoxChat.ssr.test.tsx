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
 * the absence of DOM globals is the whole point of the test.
 */
/// <reference types="vitest/globals" />
import { renderToString } from "react-dom/server";
import { DoxChat } from "./DoxChat";

describe("DoxChat server-side render", () => {
  it("renders without touching a browser global", () => {
    expect(typeof window).toBe("undefined");
    expect(() => renderToString(<DoxChat />)).not.toThrow();
  });

  it("server-renders the empty state, including the corpus figures", () => {
    const html = renderToString(<DoxChat />);
    expect(html).toContain("Dox");
    // The pre-hydration markup a reader sees first must be the real empty
    // state, not a blank shell.
    expect(html).toContain("chunks indexed");
  });

  it("survives a server render with budget props supplied", () => {
    // The out-of-budget branch renders different markup; it must be as
    // server-safe as the default one.
    expect(() =>
      renderToString(
        <DoxChat
          brains={{
            brains: [],
            activeBrainId: null,
            visitor: { used: 5, limit: 5, remaining: 0, unlimited: false },
            resetsAt: new Date().toISOString(),
          }}
        />,
      ),
    ).not.toThrow();
  });
});
