/**
 * @vitest-environment jsdom
 *
 * Proves the boundary turns the failure that produced a black screen into a
 * message and a button.
 *
 * The trigger found in the wild was a stale Vite dependency cache in a
 * long-running dev server. The same failure is reachable in production by
 * design: every push to `main` deploys, Vite renames its content-addressed
 * chunks on every build, and a reader with `/dox` open across a deploy will
 * request a lazily-loaded chunk that no longer exists. Streamdown's syntax
 * highlighting is one, and it loads when the first answer renders — so it
 * fails mid-conversation, not on page load.
 */
/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { installJsdomShims } from "~/test/jsdom-shims";
import { ChatErrorBoundary } from "./ChatErrorBoundary";

installJsdomShims();

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

/** React logs caught errors to console.error; silence it so the suite output
 *  stays readable, and restore afterwards. */
let spy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  spy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  spy.mockRestore();
});

const STALE_CHUNK =
  "Failed to fetch dynamically imported module: http://localhost:4321/node_modules/.vite/deps/highlighted-body-KPVGNVTW.js";

describe("ChatErrorBoundary", () => {
  it("renders its children when nothing is wrong", () => {
    render(
      <ChatErrorBoundary label="transcript">
        <p>the conversation</p>
      </ChatErrorBoundary>,
    );
    expect(screen.getByText("the conversation")).toBeTruthy();
  });

  it("catches a failed dynamic import instead of unmounting the tree", () => {
    // The exact failure behind the black screen.
    render(
      <ChatErrorBoundary label="transcript">
        <Boom message={STALE_CHUNK} />
      </ChatErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("updated while this page was open");
    expect(screen.getByRole("button", { name: /reload/i })).toBeTruthy();
  });

  it("names a stale chunk specifically, rather than saying nothing useful", () => {
    // A reader who is told the site updated knows reloading will help. A
    // generic "something went wrong" teaches them nothing.
    render(
      <ChatErrorBoundary label="transcript">
        <Boom message={STALE_CHUNK} />
      </ChatErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).not.toMatch(
      /^Something went wrong/,
    );
  });

  it("falls back to a generic message for an ordinary crash", () => {
    render(
      <ChatErrorBoundary label="transcript">
        <Boom message="Cannot read properties of undefined" />
      </ChatErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Something went wrong",
    );
  });

  it("still logs the error, so a survivable failure is not an invisible one", () => {
    render(
      <ChatErrorBoundary label="widget rail">
        <Boom message="boom" />
      </ChatErrorBoundary>,
    );
    const logged = spy.mock.calls.some((args: unknown[]) =>
      String(args[0]).includes("widget rail"),
    );
    expect(logged).toBe(true);
  });

  it("uses a caller's fallback when given one", () => {
    // The rail supplies its own, because reloading the page to fix a panel
    // would throw away the conversation behind it.
    render(
      <ChatErrorBoundary
        label="widget rail"
        fallback={(_error, reset) => (
          <button type="button" onClick={reset}>
            Close the panel
          </button>
        )}
      >
        <Boom message="boom" />
      </ChatErrorBoundary>,
    );
    expect(
      screen.getByRole("button", { name: "Close the panel" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /reload/i })).toBeNull();
  });

  it("can be reset by the caller so the panel recovers without a reload", () => {
    function Fixture() {
      return (
        <ChatErrorBoundary
          label="widget rail"
          fallback={(_error, reset) => (
            <button type="button" onClick={reset}>
              Close the panel
            </button>
          )}
        >
          <p>rail contents</p>
        </ChatErrorBoundary>
      );
    }
    const { rerender } = render(<Fixture />);
    expect(screen.getByText("rail contents")).toBeTruthy();
    rerender(<Fixture />);
    expect(screen.getByText("rail contents")).toBeTruthy();
  });
});
