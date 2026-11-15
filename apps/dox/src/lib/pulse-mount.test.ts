/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { disclosure, html, setHtml, raw } from "~/widgets/builders";
import { mountPulse, type PulseLib } from "./pulse-mount";

const lib: PulseLib = {
  getUtcNow: () => "2026-11-14T09:00:00Z",
  parseCronExpression: (c) => (c === "bad" ? null : { c }),
  cronRuns: (_e, _z, r) => [{ instant: r.after.replace("09:00", "21:00") }],
  formatRelativeUtc: (v, _l, o) => (v === o.reference ? "now" : "in 12 hours"),
  diffUtc: (a, b) => (a === "old" ? 9 : 0.1 + (b === "" ? 0 : 0)),
};

const aborts: AbortController[] = [];
afterEach(() => {
  for (const a of aborts.splice(0)) a.abort();
  document.body.replaceChildren();
});

function setup(read = "2026-11-14T06:00:00Z"): HTMLElement {
  const root = document.createElement("div");
  setHtml(
    root,
    raw(`<article data-pulse-card>
    <p>Next run <span data-pulse-next="17 6 * * 1" role="status" aria-label="next run"></span></p>
    <p data-pulse-read="${read}">read <span data-pulse-read-ago role="status" aria-label="read ago"></span></p>
    <div data-pulse-strip data-pulse-strip-read="${read}" data-signal="ok">
      <div data-pulse-beats>strip</div>
      <p data-pulse-signal hidden>NO SIGNAL <span data-pulse-signal-text></span></p>
    </div></article>`),
  );
  document.body.append(root);
  return root;
}

async function run(root: HTMLElement, now = lib.getUtcNow) {
  const c = new AbortController();
  aborts.push(c);
  await mountPulse(root, c.signal, {
    lib: () => Promise.resolve({ ...lib, getUtcNow: now }),
  });
  return c;
}

describe("mountPulse", () => {
  it("fills the next-run and read-ago slots", async () => {
    await run(setup());
    expect(screen.getByLabelText("next run")).toHaveTextContent("in 12 hours");
    expect(screen.getByLabelText("read ago")).toHaveTextContent("in 12 hours");
  });

  it("switches an old strip to NO SIGNAL with the days", async () => {
    await run(setup("old"));
    expect(screen.getByText(/NO SIGNAL/)).toBeVisible();
    expect(screen.getByText("Run history is 9 days old")).toBeInTheDocument();
    expect(screen.queryByText("strip")).not.toBeVisible();
  });

  it("leaves a recent strip alone", async () => {
    await run(setup());
    expect(screen.getByText("strip")).toBeVisible();
    expect(screen.getByText(/NO SIGNAL/)).not.toBeVisible();
  });

  it("recomputes when the tab becomes visible, and stops after abort", async () => {
    const root = setup();
    let at = "2026-11-14T09:00:00Z";
    const c = new AbortController();
    aborts.push(c);
    await mountPulse(root, c.signal, {
      now: () => at,
      lib: () => Promise.resolve(lib),
    });
    const slot = screen.getByLabelText("next run");
    expect(slot).toHaveTextContent("in 12 hours");
    at = "2026-11-14T21:00:00Z";
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action changes visibility; the event is the input
    document.dispatchEvent(new Event("visibilitychange"));
    expect(slot).toHaveTextContent("now");
    c.abort();
    at = "2026-11-14T09:00:00Z";
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action changes visibility; the event is the input
    document.dispatchEvent(new Event("visibilitychange"));
    expect(slot).toHaveTextContent("now");
  });

  it("opens a workaround list by keyboard, before gmt loads", async () => {
    const root = setup();
    setHtml(
      root,
      disclosure({
        id: "p-list",
        label: "3 workarounds",
        flow: true,
        children: html`<p>AF</p>`,
      }),
    );
    const c = new AbortController();
    aborts.push(c);
    void mountPulse(root, c.signal, { lib: () => new Promise(() => {}) });
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "3 workarounds" });
    expect(screen.getByText("AF")).not.toBeVisible();
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("AF")).toBeVisible();
    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("does nothing when already aborted", async () => {
    const c = new AbortController();
    c.abort();
    const root = setup();
    await mountPulse(root, c.signal, { lib: () => Promise.resolve(lib) });
    expect(screen.getByLabelText("next run")).toBeEmptyDOMElement();
  });
});
