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
/// <reference types="vitest/globals" />
import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { installJsdomShims } from "~/test/jsdom-shims";
import { MountedWidget } from "./MountedWidget";
import type { AnyWidgetEntry } from "./widget-registry";

installJsdomShims();

/** A widget that records exactly what happened to it. */
function spyEntry(overrides: Partial<AnyWidgetEntry> = {}) {
  const log: string[] = [];
  const entry: AnyWidgetEntry = {
    title: "Test Widget",
    kind: "globe",
    parse: (input) => ({ ok: true, args: input }),
    renderTemplate: (idPrefix) =>
      `<div data-role="stage" id="${idPrefix}-stage"></div>`,
    load: async () => ({
      mount: async (root, _args, signal) => {
        log.push("mount");
        // A real mount awaits a dynamic import; this is the window in which
        // StrictMode's cleanup lands.
        await Promise.resolve();
        if (signal.aborted) {
          log.push("aborted");
          return { destroy: () => {} };
        }
        const stage = root.querySelector('[data-role="stage"]');
        stage?.setAttribute("data-mounted", "");
        log.push("wired");
        let destroyed = false;
        return {
          destroy: () => {
            if (destroyed) return;
            destroyed = true;
            log.push("destroy");
          },
        };
      },
    }),
    ...overrides,
  };
  return { entry, log };
}

describe("MountedWidget", () => {
  it("renders the template and wires it once", async () => {
    const { entry, log } = spyEntry();
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);

    await waitFor(() => expect(log).toContain("wired"));
    expect(log.filter((l) => l === "wired")).toHaveLength(1);
    expect(document.querySelector("[data-mounted]")).not.toBeNull();
  });

  it("wires exactly once under StrictMode", async () => {
    // The whole point. A double-wire here is two sets of listeners on every
    // control, and it would show up only as subtly doubled behaviour.
    const { entry, log } = spyEntry();
    render(
      <StrictMode>
        <MountedWidget entry={entry} args={{}} idPrefix="t" />
      </StrictMode>,
    );

    await waitFor(() => expect(log).toContain("wired"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(log.filter((l) => l === "wired")).toHaveLength(1);
  });

  it("tells a mount already in flight to stop, via the abort signal", async () => {
    /* The case the `cancelled` flag cannot cover. Once `mount()` has been
       entered, `MountedWidget` has no way to reach inside it — a mount that is
       part-way through wiring a globe (an rAF loop started, a clock interval
       running) has to be told to stop by something it can observe. That is what
       the AbortSignal is for, and it is why every mount checks it after each
       await rather than relying on its caller. */
    const log: string[] = [];
    let releaseMount: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseMount = resolve;
    });

    const entry: AnyWidgetEntry = {
      title: "Slow Widget",
      kind: "globe",
      parse: (input) => ({ ok: true, args: input }),
      renderTemplate: () => "<div></div>",
      load: async () => ({
        mount: async (_root, _args, signal) => {
          log.push("mount:entered");
          await gate;
          if (signal.aborted) {
            log.push("mount:observed-abort");
            return { destroy: () => {} };
          }
          log.push("mount:wired-anyway");
          return { destroy: () => log.push("destroy") };
        },
      }),
    };

    const { unmount } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    // Let the effect get all the way into `mount` and suspend on the gate.
    await waitFor(() => expect(log).toContain("mount:entered"));

    unmount();
    await act(async () => {
      releaseMount();
      await gate;
      await Promise.resolve();
    });

    expect(log).toContain("mount:observed-abort");
    expect(log).not.toContain("mount:wired-anyway");
  });

  it("releases a handle that resolves after cleanup has already run", async () => {
    // Belt to the signal's braces: a mount that ignores the signal still hands
    // back a live handle, and nothing else will ever destroy it.
    const log: string[] = [];
    let releaseMount: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseMount = resolve;
    });

    const entry: AnyWidgetEntry = {
      title: "Careless Widget",
      kind: "globe",
      parse: (input) => ({ ok: true, args: input }),
      renderTemplate: () => "<div></div>",
      load: async () => ({
        mount: async () => {
          log.push("entered");
          await gate;
          // Deliberately ignores the signal.
          return { destroy: () => log.push("destroy") };
        },
      }),
    };

    const { unmount } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    await waitFor(() => expect(log).toContain("entered"));

    unmount();
    await act(async () => {
      releaseMount();
      await gate;
      await Promise.resolve();
    });

    expect(log).toContain("destroy");
  });

  it("tears down and clears the host on unmount", async () => {
    const { entry, log } = spyEntry();
    const { unmount } = render(
      <MountedWidget entry={entry} args={{}} idPrefix="t" />,
    );
    await waitFor(() => expect(log).toContain("wired"));

    unmount();
    expect(log).toContain("destroy");
    expect(document.querySelector("[data-mounted]")).toBeNull();
  });

  it("renders an error state for a nonsense argument instead of mounting", async () => {
    const { entry, log } = spyEntry({
      validate: async () =>
        "Mars/Olympus_Mons isn't a time zone this browser knows about.",
    });
    render(
      <MountedWidget
        entry={entry}
        args={{ zone: "Mars/Olympus_Mons" }}
        idPrefix="t"
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Mars/Olympus_Mons",
      ),
    );
    // It must not have mounted at all — an error state, not a broken widget.
    expect(log).not.toContain("wired");
  });

  it("survives a mount that throws, rather than taking the panel down", async () => {
    const { entry } = spyEntry({
      load: async () => ({
        mount: async () => {
          throw new Error("boom");
        },
      }),
    });
    render(<MountedWidget entry={entry} args={{}} idPrefix="t" />);

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "couldn't be shown",
      ),
    );
  });

  it("does not remount when the parent re-renders with an equal args object", async () => {
    // A streamed tool part yields a fresh object identity on every token; a
    // dependency on identity would remount the widget on each one.
    const { entry, log } = spyEntry();
    const { rerender } = render(
      <MountedWidget
        entry={entry}
        args={{ zone: "Asia/Tokyo" }}
        idPrefix="t"
      />,
    );
    await waitFor(() => expect(log).toContain("wired"));

    rerender(
      <MountedWidget
        entry={entry}
        args={{ zone: "Asia/Tokyo" }}
        idPrefix="t"
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(log.filter((l) => l === "wired")).toHaveLength(1);
  });
});
