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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
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
  it("renders its children when nothing is wrong", async () => {
    const { container } = render(
      <ChatErrorBoundary label="transcript">
        <p>the conversation</p>
      </ChatErrorBoundary>,
    );
    expect(screen.getByText("the conversation")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("catches a failed dynamic import instead of unmounting the tree", async () => {
    // The exact failure behind the black screen.
    const { container } = render(
      <ChatErrorBoundary label="transcript">
        <Boom message={STALE_CHUNK} />
      </ChatErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "updated while this page was open",
    );
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("names a stale chunk specifically, rather than saying nothing useful", async () => {
    // A reader who is told the site updated knows reloading will help. A
    // generic "something went wrong" teaches them nothing.
    const { container } = render(
      <ChatErrorBoundary label="transcript">
        <Boom message={STALE_CHUNK} />
      </ChatErrorBoundary>,
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      /^Something went wrong/,
    );
    await expectNoAxeViolations(container);
  });

  it("falls back to a generic message for an ordinary crash", async () => {
    const { container } = render(
      <ChatErrorBoundary label="transcript">
        <Boom message="Cannot read properties of undefined" />
      </ChatErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await expectNoAxeViolations(container);
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

  it("uses a caller's fallback when given one", async () => {
    // The rail supplies its own, because reloading the page to fix a panel
    // would throw away the conversation behind it.
    const { container } = render(
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
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reload/i }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("can be reset by the caller so the panel recovers without a reload", async () => {
    const user = userEvent.setup();
    // Fails on the first render only, as a transient fault would.
    let failing = true;
    function Flaky() {
      if (failing) throw new Error("boom");
      return <p>rail contents</p>;
    }
    const { container } = render(
      <ChatErrorBoundary
        label="widget rail"
        fallback={(_error, reset) => (
          <button type="button" onClick={reset}>
            Close the panel
          </button>
        )}
      >
        <Flaky />
      </ChatErrorBoundary>,
    );
    expect(screen.queryByText("rail contents")).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole("button", { name: "Close the panel" }));
    expect(screen.getByText("rail contents")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close the panel" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
