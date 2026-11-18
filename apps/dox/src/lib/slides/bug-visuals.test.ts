/** @vitest-environment jsdom */
import { screen } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import { html, setHtml } from "~/widgets/builders";
import { mountBugVisuals, pageState } from "./bug-visuals";
import { writeDeckState } from "./deck-state";
import {
  dataOf,
  pick,
  pickAll,
  sendDeckState,
  sendLapse,
  textOf,
} from "~/test/deck-events";

installJsdomShims();

let abort: AbortController;
let root: HTMLElement;

const win = {
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  matchMedia: () => ({ matches: true }),
};

const go = (id: string, build: number): void => sendDeckState(root, id, build);

beforeEach(() => {
  abort = new AbortController();
  root = document.createElement("div");
  setHtml(
    root,
    html`
      <section data-slide id="abort">
        <div data-visual="terminal">
          <span data-type data-text="node -e boom"></span>
          <p data-after>Node stops the whole process.</p>
        </div>
      </section>
      <section data-slide id="years">
        <div data-visual="roll">
          <span data-roll data-end="2124-03-20"></span>
          <span data-roll data-end="2124-03-21"></span>
        </div>
      </section>
      <section data-slide id="date">
        <table data-visual="rows">
          <tbody>
            <tr data-row="1">
              <td><code aria-hidden="true" data-type data-text="first(row)">first(row)</code><code>first(row)</code></td>
              <td>epoch</td>
            </tr>
            <tr data-row="2">
              <td><code aria-hidden="true" data-type data-text="second(row)">second(row)</code><code>second(row)</code></td>
              <td>now</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section data-slide id="manila">
        <ol data-visual="pages" data-zone="Asia/Manila">
          <li data-page data-date="1844-12-30" data-gap="false">30</li>
          <li data-page data-date="1844-12-31" data-gap="true">31</li>
          <li data-page data-date="1845-01-01" data-gap="false">1</li>
        </ol>
      </section>
    `,
  );
  document.body.append(root);
});

afterEach(() => {
  abort.abort();
  root.remove();
});

const pages = (): Array<string | undefined> =>
  pickAll(root, "[data-page]").map((p) => dataOf(p, "state"));

describe("a page's state", () => {
  const gap = { date: "1844-12-31", gap: true };
  it("drops a date the zone never had once the clock is past it", () => {
    expect(pageState(gap, "1844-12-30")).toBe("future");
    expect(pageState(gap, "1845-01-01")).toBe("dropped");
    expect(pageState({ date: "1844-12-30", gap: false }, "1845-01-01")).toBe(
      "past",
    );
    expect(pageState({ date: "1845-01-01", gap: false }, "1845-01-01")).toBe(
      "current",
    );
  });
});

describe("a table whose rows all arrive with the slide", () => {
  const typed = (): string[] =>
    pickAll(root, "code[aria-hidden]").map((c) => textOf(c));
  const states = (): Array<string | undefined> =>
    pickAll(root, "[data-row]").map((r) => dataOf(r, "state"));

  it("shows no row before the slide, then every row at once on arrival", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("years", 0);
    expect(typed()).toEqual(["", ""]);
    expect(states()).toEqual(["hidden", "hidden"]);
    go("date", 0);
    expect(typed()).toEqual(["first(row)", "second(row)"]);
    expect(states()).toEqual(["done", "done"]);
  });

  it("clears every row on leaving", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("date", 0);
    go("years", 0);
    expect(typed()).toEqual(["", ""]);
    expect(states()).toEqual(["hidden", "hidden"]);
  });

  it("types every row out together when motion is allowed", () => {
    const frames: Array<(stamp: number) => void> = [];
    mountBugVisuals(root, {
      signal: abort.signal,
      win: {
        requestAnimationFrame: (cb) => frames.push(cb),
        cancelAnimationFrame: () => {},
        matchMedia: () => ({ matches: false }),
      },
    });
    go("date", 0);
    expect(states()).toEqual(["typing", "typing"]);
    for (const f of frames.splice(0)) f(0);
    for (const f of frames.splice(0)) f(38 * 3);
    expect(typed()).toEqual(["fir", "sec"]);
  });
});

describe("the bug visuals", () => {
  it("hides the process's answer until its slide is reached, then shows it", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    expect(
      screen.queryByText("Node stops the whole process."),
    ).not.toBeVisible();
    go("abort", 0);
    expect(screen.getByText("Node stops the whole process.")).toBeVisible();
    expect(textOf(pick(root, "[data-type]"))).toBe("node -e boom");
  });

  it("resets a visual when its slide is left", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("abort", 0);
    go("years", 0);
    expect(textOf(pick(root, "[data-type]"))).toBe("");
    expect(pickAll(root, "[data-roll]").map((r) => textOf(r))).toEqual([
      "2124-03-20",
      "2124-03-21",
    ]);
  });

  it("lands both counters on their values", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("years", 0);
    expect(pickAll(root, "[data-roll]").map((r) => textOf(r))).toEqual([
      "2124-03-20",
      "2124-03-21",
    ]);
  });

  it("starts from a deck already on the slide when it mounts", () => {
    writeDeckState(root, { id: "years", build: 0 });
    mountBugVisuals(root, { signal: abort.signal, win });
    expect(pickAll(root, "[data-roll]").map((r) => textOf(r))).toEqual([
      "2124-03-20",
      "2124-03-21",
    ]);
  });

  it("turns the skipped page over as the zone's date crosses it", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("manila", 0);
    const lapse = (date: string): void => {
      sendLapse(root, { dates: { "Asia/Manila": date } });
    };
    lapse("1844-12-30");
    expect(pages()).toEqual(["current", "future", "future"]);
    lapse("1845-01-01");
    expect(pages()).toEqual(["past", "dropped", "current"]);
  });

  it("ignores a lapse for a visual that is not on screen", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("abort", 0);
    sendLapse(root, { dates: { "Asia/Manila": "1845-01-01" } });
    expect(pages()).toEqual(["future", "future", "future"]);
  });
});
