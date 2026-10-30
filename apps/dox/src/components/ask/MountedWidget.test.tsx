/**
 * @vitest-environment jsdom
 *
 * `MountedWidget`'s lifecycle, including the two things most likely to break
 * silently:
 *
 *   - **React StrictMode double-invokes effects.** Every mount here is async,
 *     so cleanup runs *before the first mount's await settles* — the handle does
 *     not exist yet when `destroy()` would be called. If that is mishandled, the
 *     widget double-wires its listeners and leaks an rAF loop and a per-second
 *     clock interval, on day one, in development only.
 *   - **A nonsense argument must render an error state, not crash the panel.**
 */
import { StrictMode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetLoadError } from "~/lib/widget-mount";
import { html } from "~/widgets/builders";
import { defineElements } from "~/widgets/define";
import { grow } from "~/widgets/primitives/grow/grow";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations, flushWidget } from "~/test/render-widget";
import { MountedWidget } from "./MountedWidget";
import type { AnyWidgetEntry } from "./widget-registry";

installJsdomShims();

const STAGE = "Stage";

/** A widget that records exactly what happened to it. */
function spyEntry(overrides: Partial<AnyWidgetEntry> = {}) {
  const spies = {
    mount: vi.fn(),
    wired: vi.fn(),
    aborted: vi.fn(),
    destroy: vi.fn(),
  };
  const entry: AnyWidgetEntry = {
    title: "Test Widget",
    kind: "globe",
    parse: (input) => ({ ok: true, args: input }),
    load: async () => ({
      renderTemplate: (idPrefix: string) =>
        html`<section aria-label="${STAGE}" id="${idPrefix}-stage"
          ><output>Waiting</output></section
        >`,
      mount: async (root, _args, signal) => {
        spies.mount();
        // A real mount awaits a dynamic import; this is the window in which
        // StrictMode's cleanup lands.
        await Promise.resolve();
        if (signal.aborted) {
          spies.aborted();
          return { destroy: () => {} };
        }
        within(root).getByRole<HTMLOutputElement>("status").value = "Wired";
        spies.wired();
        let destroyed = false;
        return {
          destroy: () => {
            if (destroyed) return;
            destroyed = true;
            spies.destroy();
          },
        };
      },
    }),
    ...overrides,
  };
  return { entry, spies };
}

/** A promise a test settles by hand, to hold a load or a mount open. */
function gate() {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

describe("MountedWidget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the template and wires it once", async () => {
    const { entry, spies } = spyEntry();
    const { container } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    await flushWidget();

    expect(spies.wired).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: STAGE })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Wired");
    await expectNoAxeViolations(container);
  });

  it("wires exactly once under StrictMode", async () => {
    // The whole point. A double-wire here is two sets of listeners on every
    // control, and it would show up only as subtly doubled behaviour.
    const { entry, spies } = spyEntry();
    render(
      <StrictMode>
        <MountedWidget entry={entry} args={{}} idPrefix="t" />
      </StrictMode>,
    );
    await flushWidget();

    expect(spies.wired).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("region", { name: STAGE })).toHaveLength(1);
  });

  it("tells a mount already in flight to stop, via the abort signal", async () => {
    /* The case the `cancelled` flag cannot cover. Once `mount()` has been
       entered, `MountedWidget` has no way to reach inside it — a mount that is
       part-way through wiring a globe (an rAF loop started, a clock interval
       running) has to be told to stop by something it can observe. That is what
       the AbortSignal is for, and it is why every mount checks it after each
       await rather than relying on its caller. */
    const held = gate();
    const { entry, spies } = spyEntry({
      title: "Slow Widget",
      load: async () => ({
        renderTemplate: () => html`<p>Slow</p>`,
        mount: async (_root, _args, signal) => {
          spies.mount();
          await held.opened;
          if (signal.aborted) {
            spies.aborted();
            return { destroy: () => {} };
          }
          spies.wired();
          return { destroy: spies.destroy };
        },
      }),
    });

    const { unmount } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    // Let the effect get all the way into `mount` and suspend on the gate.
    await flushWidget();
    expect(spies.mount).toHaveBeenCalledOnce();

    unmount();
    held.open();
    await flushWidget();

    expect(spies.aborted).toHaveBeenCalledOnce();
    expect(spies.wired).not.toHaveBeenCalled();
  });

  it("releases a handle that resolves after cleanup has already run", async () => {
    // Belt to the signal's braces: a mount that ignores the signal still hands
    // back a live handle, and nothing else will ever destroy it.
    const held = gate();
    const { entry, spies } = spyEntry({
      title: "Careless Widget",
      load: async () => ({
        renderTemplate: () => html`<p>Careless</p>`,
        mount: async () => {
          spies.mount();
          await held.opened;
          // Deliberately ignores the signal.
          return { destroy: spies.destroy };
        },
      }),
    });

    const { unmount } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    await flushWidget();
    expect(spies.mount).toHaveBeenCalledOnce();

    unmount();
    held.open();
    await flushWidget();

    expect(spies.destroy).toHaveBeenCalledOnce();
  });

  it("tears down and clears the host on unmount", async () => {
    const { entry, spies } = spyEntry();
    const { unmount } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    await flushWidget();
    expect(screen.getByRole("region", { name: STAGE })).toBeInTheDocument();

    unmount();
    expect(spies.destroy).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("region", { name: STAGE }),
    ).not.toBeInTheDocument();
  });

  it("renders an error state for a nonsense argument instead of mounting", async () => {
    const { entry, spies } = spyEntry({
      validate: async () =>
        "Mars/Olympus_Mons isn't a time zone this browser knows about.",
    });
    const { container } = render(
      <MountedWidget
        entry={entry}
        args={{ zone: "Mars/Olympus_Mons" }}
        idPrefix="t"
      />,
    );
    await flushWidget();

    expect(screen.getByRole("alert")).toHaveTextContent("Mars/Olympus_Mons");
    // It must not have mounted at all — an error state, not a broken widget.
    expect(spies.wired).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: STAGE }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("names the error by the widget that failed", async () => {
    const { entry } = spyEntry({ validate: async () => "Bad input." });
    const { container } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    await flushWidget();
    expect(
      screen.getByRole("alert", { name: "Test Widget couldn\u2019t be shown" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("survives a mount that throws, rather than taking the panel down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { entry } = spyEntry({
      load: async () => ({
        renderTemplate: () => html`<p>Boom</p>`,
        mount: async () => {
          throw new Error("boom");
        },
      }),
    });
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);
    await flushWidget();

    expect(screen.getByRole("alert")).toHaveTextContent("couldn't be shown");
  });

  it("does not remount when the parent re-renders with an equal args object", async () => {
    // A streamed tool part yields a fresh object identity on every token; a
    // dependency on identity would remount the widget on each one.
    const { entry, spies } = spyEntry();
    const { rerender } = render(
      <MountedWidget
        entry={entry}
        args={{ zone: "Asia/Tokyo" }}
        idPrefix="t"
      />,
    );
    await flushWidget();

    rerender(
      <MountedWidget
        entry={entry}
        args={{ zone: "Asia/Tokyo" }}
        idPrefix="t"
      />,
    );
    await flushWidget();
    expect(spies.mount).toHaveBeenCalledOnce();
    expect(spies.wired).toHaveBeenCalledOnce();
  });

  it("marks the host busy until the mount has wired it", async () => {
    const held = gate();
    const { entry } = spyEntry({
      load: async () => {
        await held.opened;
        return spyEntry().entry.load();
      },
    });
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);

    // The host is a plain box with no role, so it is reached from what it holds.
    // oxlint-disable-next-line testing-library/no-node-access -- the busy state sits on the host, which has no role to query
    const host = screen.getByRole("status").parentElement;
    expect(host).toHaveAttribute("aria-busy", "true");

    held.open();
    await flushWidget();
    expect(host).not.toHaveAttribute("aria-busy");
  });

  it("offers a retry when the library failed to load, and remounts on it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    let failures = 1;
    const { entry: working, spies } = spyEntry();
    const { entry } = spyEntry({
      load: async () => {
        if (failures > 0) {
          failures -= 1;
          return {
            renderTemplate: () => html`<p>Offline</p>`,
            mount: async () => {
              throw new WidgetLoadError(new Error("offline"));
            },
          };
        }
        return working.load();
      },
    });
    const { container } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    await flushWidget();

    expect(screen.getByRole("alert")).toHaveTextContent("didn't load");
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await flushWidget();
    expect(spies.wired).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("treats a failed import of the mount module itself as a load failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { entry } = spyEntry({
      load: async () => {
        throw new TypeError(
          "Failed to fetch dynamically imported module: x.js",
        );
      },
    });
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);
    await flushWidget();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("offers no retry for a nonsense argument or a mount that throws on its input", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { entry } = spyEntry({
      load: async () => ({
        renderTemplate: () => html`<p>Bad</p>`,
        mount: async () => {
          throw new Error("bad input");
        },
      }),
    });
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);
    await flushWidget();
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't be shown");
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("shows a loading placeholder while the widget's chunk loads, then the template", async () => {
    const held = gate();
    const { entry } = spyEntry();
    const slow: AnyWidgetEntry = {
      ...entry,
      load: async () => {
        await held.opened;
        return entry.load();
      },
    };
    const { container } = render(
      <MountedWidget entry={slow} args={{}} idPrefix="t" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading Test Widget…",
    );
    expect(
      screen.queryByRole("region", { name: STAGE }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);

    held.open();
    await flushWidget();
    expect(screen.getByRole("region", { name: STAGE })).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent("Loading");
  });

  it("shows a title as text in the loading placeholder, never as markup", () => {
    const { entry } = spyEntry({ title: "<b>Bold</b> & co" });
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading <b>Bold</b> & co…",
    );
  });
});

describe("MountedWidget height easing", () => {
  /** Records what the shared observer is told to watch. */
  class FakeObserver {
    static observed = new Set<Element>();
    static disconnects = 0;
    observe(el: Element): void {
      FakeObserver.observed.add(el);
    }
    unobserve(el: Element): void {
      FakeObserver.observed.delete(el);
    }
    disconnect(): void {
      FakeObserver.observed.clear();
      FakeObserver.disconnects += 1;
    }
  }

  /** A widget whose template holds one grow region, as the kit builds it. */
  function growEntry() {
    return spyEntry({
      load: async () => ({
        renderTemplate: () =>
          html`<section aria-label="${STAGE}"
            >${grow(html`<p>Result</p>`)}</section
          >`,
        mount: async () => {
          defineElements();
          return { destroy: () => {} };
        },
      }),
    });
  }

  beforeEach(() => {
    FakeObserver.observed = new Set();
    FakeObserver.disconnects = 0;
    vi.stubGlobal("ResizeObserver", FakeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("eases the host's own height from the first frame", async () => {
    const { entry } = spyEntry();
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);
    await flushWidget();

    expect(FakeObserver.observed.size).toBe(1);
    expect(screen.getByRole("region", { name: STAGE })).toBeInTheDocument();
  });

  it("lets a grow region in the template ease itself, nested inside the host's", async () => {
    const { entry } = growEntry();
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);
    await flushWidget();

    // The host's box and the template's own region.
    expect(FakeObserver.observed.size).toBe(2);
    expect(screen.getByText("Result")).toBeVisible();
  });

  it("stops observing on unmount", async () => {
    const { entry } = spyEntry();
    const { unmount } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    await flushWidget();
    expect(FakeObserver.observed.size).toBe(1);

    unmount();

    expect(FakeObserver.observed.size).toBe(0);
    expect(FakeObserver.disconnects).toBeGreaterThan(0);
  });

  it("observes nothing without ResizeObserver, and still shows the widget", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { entry } = growEntry();
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);
    await flushWidget();

    expect(FakeObserver.observed.size).toBe(0);
    expect(screen.getByText("Result")).toBeVisible();
  });
});
