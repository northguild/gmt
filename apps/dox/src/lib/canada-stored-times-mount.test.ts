/**
 * @vitest-environment jsdom
 *
 * "Did your saved events move?" as a reader meets it: `storedSection` wired by `wireStoredTimes`.
 * The Worker's answer is built by the real Worker code in this test runtime, so every row is the
 * library's own reading here. The browser's time zone check is the test's to give: it calls
 * `setStaleZones` or `browserUnchecked` as the checker's mount would.
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "~/test/jsdom-shims";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { storedSection } from "~/widgets/families/clockcheck/stored-section";
import { html } from "~/widgets/builders/html";
import { widget } from "~/widgets/builders/layout";
import { defineElements } from "~/widgets/define";
import { findWidget } from "~/widgets/root";
import { renderHtml } from "~/widgets/test-fixture";
import { computeStoredCheck } from "../../worker/clock-change-shared";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import { STORED_PRESET } from "./canada-clock-change";
import {
  storedFix,
  storedVerdict,
  STORED_MAX_LINES,
} from "./clock-change-stored-lines";
import { storedTruncatedText, wireStoredTimes } from "./clock-change-stored";
import type { StoredHandle } from "./clock-change-stored";
import {
  CANADA_STORED,
  SAVED_EXAMPLE,
  STORED_EXAMPLE,
} from "./canada-saved-example";

installJsdomShims();

type Posted = { lines: string; zone: string };

function fakeFetch(
  options: { post?: (body: Posted) => Response | Promise<Response> } = {},
): { fetch: typeof fetch; posts: Posted[] } {
  const posts: Posted[] = [];
  const impl = async (_url: unknown, init?: RequestInit) => {
    const form = init?.body as FormData;
    const body = {
      lines: String(form.get("lines")),
      zone: String(form.get("zone")),
    };
    posts.push(body);
    return (
      options.post?.(body) ??
      Response.json(computeStoredCheck(body.lines, body.zone))
    );
  };
  return { fetch: impl as unknown as typeof fetch, posts };
}

const config = { ...CANADA_STORED, idPrefix: "test" };
const controllers: AbortController[] = [];
afterEach(() => {
  controllers.splice(0).forEach((c) => c.abort());
});

/**
 * Renders the section and wires it. `stale` is what the browser check found: a list of zones whose
 * data is old, or `null` to leave the check undone (the test then calls the handle itself).
 */
async function mounted(
  fetchFn: typeof fetch,
  stale: readonly string[] | null = [],
) {
  defineElements();
  renderHtml(
    html`${widget({ name: "stored-test", label: "Saved events", scope: "test" }, storedSection(config))}`,
  );
  const controller = new AbortController();
  controllers.push(controller);
  const handle: StoredHandle = wireStoredTimes(
    findWidget(document.body, "stored-test"),
    config,
    controller.signal,
    fetchFn,
  );
  if (stale !== null) handle.setStaleZones(stale);
  await handle.ready;
  return { handle, user: userEvent.setup() };
}

const box = () =>
  screen.getByRole("textbox", { name: "Saved events, one per line" });

/** Replaces the box's text and presses Check; resolves once the run's status line has cleared. */
async function check(user: ReturnType<typeof userEvent.setup>, lines: string) {
  await user.clear(box());
  if (lines !== "") await user.click(box());
  if (lines !== "") await user.paste(lines);
  await user.click(screen.getByRole("button", { name: "Check" }));
  await vi.waitFor(() =>
    expect(screen.queryByText("Checking\u2026")).not.toBeInTheDocument(),
  );
}

/** The rows of the answer table, header excluded; hidden rows are not role-visible. */
const bodyRows = () => screen.getAllByRole("row").slice(1);

describe("the saved-times example", () => {
  it("states what the library says about the saved Vancouver value", () => {
    // The library types the result as a union; the page reads the row shape `storedFix` takes.
    const result = classifyStoredZoned(SAVED_EXAMPLE.saved) as unknown as
      | (Parameters<typeof storedFix>[1] & {
          kind: string;
          storedOffset?: string;
          zoneOffset?: string;
        })
      | null;
    // Runtime data decides the verdict; a runtime older than the change reads it as valid.
    if (result !== null && result.kind === "offsetMismatch") {
      expect(result.storedOffset).toBe(SAVED_EXAMPLE.savedOffset);
      expect(result.zoneOffset).toBe(SAVED_EXAMPLE.newOffset);
      expect(SAVED_EXAMPLE.fixed).toBe(
        SAVED_EXAMPLE.saved.replace(
          SAVED_EXAMPLE.savedOffset,
          SAVED_EXAMPLE.newOffset,
        ),
      );
      const fix = storedFix(SAVED_EXAMPLE.saved, result);
      expect(fix?.keepLocal).toBe(SAVED_EXAMPLE.fixed);
      expect(fix?.oldLocal).toBe(SAVED_EXAMPLE.shownHm);
    } else {
      expect(result?.kind).toBe("valid");
    }
    expect(SAVED_EXAMPLE).toMatchObject({
      wallHm: "09:00",
      savedOffset: "-08:00",
      newOffset: "-07:00",
      shownHm: "10:00",
      saved: "2026-11-15T09:00:00-08:00[America/Vancouver]",
      fixed: "2026-11-15T09:00:00-07:00[America/Vancouver]",
    });
  });
});

describe("the stored-times section", () => {
  it("is server-rendered with its purpose, three steps, a labelled form and the controls", async () => {
    renderHtml(
      html`${widget({ name: "stored-test", label: "Saved events", scope: "test" }, storedSection(config))}`,
    );
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "Did your saved events move?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Apps often save a future event with the UTC offset that applied when it was booked. Where the rules changed, that saved offset is wrong, and the app shows the event an hour off.",
      ),
    ).toBeInTheDocument();
    const steps = within(
      screen.getByRole("list", { name: "An example" }),
    ).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Booked before the change");
    expect(steps[0]).toHaveTextContent(
      "9:00, 15 Nov, Vancouver, saved as 09:00 \u221208:00",
    );
    expect(steps[1]).toHaveTextContent("Vancouver stays on \u221207:00");
    expect(steps[2]).toHaveTextContent("The saved event shows as 10:00.");
    expect(steps[2]).toHaveTextContent("Fix: store 09:00 \u221207:00");
    expect(box()).toHaveValue(STORED_EXAMPLE);
    expect(box()).toHaveAccessibleDescription(
      `Paste values like ${SAVED_EXAMPLE.saved}. Up to ${STORED_MAX_LINES} lines.`,
    );
    expect(
      screen.getByRole("button", { name: "Accepted formats" }),
    ).toBeInTheDocument();
    // Every line has its own zone, so the picker stays out of the way.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset example" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Worker|workerd/)).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("shows the zone picker only when a line has no zone", async () => {
    const { fetch } = fakeFetch();
    const { user } = await mounted(fetch);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.clear(box());
    await user.click(box());
    await user.paste("2026-11-15T09:00:00-08:00");
    const picker = screen.getByRole("combobox", {
      name: "Lines without a zone use",
    });
    expect(
      within(picker)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "America/Vancouver",
      "America/Edmonton",
      "America/Inuvik",
      "America/Winnipeg",
      "America/Toronto",
    ]);
    await expectNoAxeViolations(document.body);
  });

  it("with fresh data: normal verdicts, a summary and a copyable fix", async () => {
    const { fetch, posts } = fakeFetch();
    await mounted(fetch);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.lines).toBe(STORED_EXAMPLE);
    expect(bodyRows()).toHaveLength(4);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    const status = cellsInColumn(screen.getByRole("table"), "Status");
    expect(status[1]).toHaveTextContent("\u2713 Still right");
    expect(status[2]).toHaveTextContent("\u2713 Still right");
    // Vancouver 09:00-08:00 is an hour off whenever this host's data has the 2026e rule.
    if (status[0]!.textContent?.includes("Shows 1 h off")) {
      expect(status[0]).toHaveTextContent("\u2717 Shows 1 h off");
      const says = cellsInColumn(screen.getByRole("table"), "What to do")[0]!;
      expect(says).toHaveTextContent(
        `Keep 9:00 local: store ${SAVED_EXAMPLE.fixed}`,
      );
      expect(says).toHaveTextContent(
        "Or keep the old instant (that is 10:00 local).",
      );
      expect(
        within(says).getByRole("button", {
          name: `Copy ${SAVED_EXAMPLE.fixed}`,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/^4 checked \u00b7 (\d moved|none moved)$/),
      ).toBeInTheDocument();
    }
    expect(
      within(bodyRows()[0]!).getByTitle(SAVED_EXAMPLE.saved),
    ).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("with stale data: no tick, no cross and no advice on the affected lines; the others keep theirs", async () => {
    const { fetch } = fakeFetch();
    await mounted(fetch, ["America/Vancouver", "America/Winnipeg"]);
    const table = screen.getByRole("table");
    const rows = bodyRows();
    for (const i of [0, 3]) {
      const row = rows[i]!;
      expect(within(row).getByText("Can\u2019t check yet")).toBeInTheDocument();
      expect(row).not.toHaveTextContent(/[\u2713\u2717]/);
      expect(
        within(row).queryByRole("button", { name: /^Copy / }),
      ).not.toBeInTheDocument();
      expect(
        within(row).queryByRole("button", { name: "Readings" }),
      ).not.toBeInTheDocument();
      // The sentence is said once, in the summary bar; a row only says to try again.
      expect(cellsInColumn(table, "What to do")[i]).toHaveTextContent(
        /^Try again after the update\.$/,
      );
    }
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(
      "This check\u2019s time zone data is older than the change for Vancouver and Winnipeg, so it can\u2019t tell. Try again later, or run the command in Test your own servers.",
    );
    expect(table).not.toHaveTextContent("older than the change");
    // Toronto is not affected: it keeps its verdict.
    expect(rows[2]).toHaveTextContent("\u2713 Still right");
    expect(
      screen.getByText(
        "1 checked \u00b7 none moved \u00b7 3 can\u2019t be checked yet",
      ),
    ).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("puts the example back and checks it again on Reset example", async () => {
    const { fetch, posts } = fakeFetch();
    const { user } = await mounted(fetch);
    await user.clear(box());
    await user.click(box());
    await user.paste("x");
    await user.click(screen.getByRole("button", { name: "Reset example" }));
    expect(box()).toHaveValue(STORED_EXAMPLE);
    expect(box()).toHaveFocus();
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    await expectNoAxeViolations(document.body);
  });

  it("runs the check from the keyboard: Tab to Check, then Enter", async () => {
    const { fetch, posts } = fakeFetch();
    const { user } = await mounted(fetch);
    await user.click(box());
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Check" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await vi.waitFor(() => expect(posts).toHaveLength(2));
  });

  it("says the lines can't be judged when the browser check fails, then draws them once it answers", async () => {
    const { fetch } = fakeFetch();
    const { handle, user } = await mounted(fetch, null);
    handle.browserUnchecked();
    expect(screen.getByText("Not judged yet.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This browser\u2019s time zone data could not be checked, so no line can be judged yet. Press Check again under Your browser.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // Check gets the same message rather than "Checking\u2026".
    await check(user, STORED_PRESET);
    expect(screen.getByText("Not judged yet.")).toBeInTheDocument();
    handle.setStaleZones([]);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("Not judged yet.")).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("drops an older answer that lands after Reset example's", async () => {
    let release: (() => void) | null = null;
    const { fetch } = fakeFetch({
      post: (body) => {
        const answer = Response.json(computeStoredCheck(body.lines, body.zone));
        if (body.lines === STORED_EXAMPLE) return answer;
        return new Promise<Response>((resolve) => {
          release = () => resolve(answer);
        });
      },
    });
    const { user } = await mounted(fetch);
    await user.clear(box());
    await user.click(box());
    await user.paste("2026-07-01T12:00:00-04:00[America/Toronto]");
    await user.click(screen.getByRole("button", { name: "Check" }));
    await vi.waitFor(() => expect(release).not.toBeNull());
    await user.click(screen.getByRole("button", { name: "Reset example" }));
    await vi.waitFor(() =>
      expect(screen.queryByText("Checking\u2026")).not.toBeInTheDocument(),
    );
    expect(bodyRows()).toHaveLength(4);
    release!();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(box()).toHaveValue(STORED_EXAMPLE);
    expect(bodyRows()).toHaveLength(4);
    await expectNoAxeViolations(document.body);
  });

  it("marks every line with a pill and a plain verdict", async () => {
    const { fetch, posts } = fakeFetch();
    const { user } = await mounted(fetch);
    await check(user, `${STORED_PRESET}\nnot a stored time`);
    expect(posts.at(-1)).toEqual({
      lines: `${STORED_PRESET}\nnot a stored time`,
      zone: "America/Vancouver",
    });
    const rows = bodyRows();
    const pills = cellsInColumn(screen.getByRole("table"), "Status");
    expect(rows.length).toBeGreaterThan(8);
    rows.slice(0, 8).forEach((row, i) => {
      expect(pills[i]!.textContent?.trim()).not.toBe("");
      expect(
        within(row).getByRole("button", { name: "Readings" }),
      ).toBeInTheDocument();
    });
    // A line the library could not read says so in the sentinel, never a blank pill.
    const last = rows.at(-1)!;
    expect(within(last).getByText("NO SIGNAL")).toBeInTheDocument();
    expect(
      within(last).queryByRole("button", { name: "Readings" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("opens a row's readings on its button", async () => {
    const { fetch } = fakeFetch();
    const { user } = await mounted(fetch);
    const button = within(bodyRows()[1]!).getByRole("button", {
      name: "Readings",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(within(bodyRows()[1]!).getAllByRole("term").length).toBeGreaterThan(
      0,
    );
    await expectNoAxeViolations(document.body);
  });

  it("words a moved Vancouver meeting as the local time it now means", () => {
    expect(
      storedVerdict({
        kind: "offsetMismatch",
        zoneOffset: "-07:00",
        atStoredOffset: "2026-11-15T17:00:00Z",
      }),
    ).toEqual({ ok: false, words: "Moved: shows 10:00 local" });
    expect(storedVerdict({ kind: "valid" })).toEqual({
      ok: true,
      words: "Still correct",
    });
    expect(storedVerdict({ kind: "ambiguous" }).ok).toBe(false);
  });

  it("shows only the moved rows when the toggle says so, and all again", async () => {
    const { fetch } = fakeFetch();
    const { user } = await mounted(fetch);
    await check(user, STORED_PRESET);
    const all = bodyRows().length;
    await user.click(screen.getByRole("button", { name: "Only moved" }));
    expect(screen.getByRole("button", { name: "Only moved" })).toBePressed();
    const moved = bodyRows();
    expect(moved.length).toBeLessThan(all);
    moved.forEach((row) =>
      expect(row).not.toHaveTextContent("\u2713 Still right"),
    );
    await expectNoAxeViolations(document.body);
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(bodyRows()).toHaveLength(all);
    await expectNoAxeViolations(document.body);
  });

  it("tells the reader when the toggle leaves no line", async () => {
    const { fetch } = fakeFetch();
    const { user } = await mounted(fetch);
    await check(user, "2026-07-01T12:00:00-04:00[America/Toronto]");
    await user.click(screen.getByRole("button", { name: "Only moved" }));
    expect(
      screen.getByText("No line is left with this filter."),
    ).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("names the last row's line in the truncated message", async () => {
    const many = Array.from({ length: STORED_MAX_LINES + 5 }, () => "x").join(
      "\n",
    );
    const { fetch } = fakeFetch();
    const { user } = await mounted(fetch);
    await check(user, many);
    expect(
      screen.getByText(
        `The input was over ${STORED_MAX_LINES} lines or 20,000 bytes; lines after line ${STORED_MAX_LINES} were not read.`,
      ),
    ).toBeInTheDocument();
    expect(
      storedTruncatedText({
        zone: "America/Toronto",
        truncated: true,
        rows: [],
      }),
    ).toContain("no line was read");
    await expectNoAxeViolations(document.body);
  });

  it("clears the truncated message on the next answer", async () => {
    const { fetch } = fakeFetch();
    const { user } = await mounted(fetch);
    await check(user, Array.from({ length: 205 }, () => "x").join("\n"));
    expect(screen.getByText(/lines after line/)).toBeInTheDocument();
    await check(user, "2026-07-01T12:00:00-04:00[America/Toronto]");
    expect(screen.queryByText(/lines after line/)).not.toBeInTheDocument();
  });

  it("says nothing was found for empty input", async () => {
    const { fetch } = fakeFetch();
    const { user } = await mounted(fetch);
    await check(user, "");
    expect(screen.getByText(/Nothing to check/)).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("says when to try again on a 429", async () => {
    const { fetch } = fakeFetch({
      post: () =>
        new Response(JSON.stringify({ error: "x", retryable: true }), {
          status: 429,
          headers: { "retry-after": "42" },
        }),
    });
    const { user } = await mounted(fetch);
    await check(user, STORED_PRESET);
    expect(await screen.findByText("Try again in 42 s")).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("announces Checking\u2026 in a status while the request runs, then the answer", async () => {
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    let seen = 0;
    const { fetch } = fakeFetch({
      post: async (body) => {
        // The first run is the prefilled example; hold the one the reader presses.
        if (seen++ > 0) await held;
        return Response.json(computeStoredCheck(body.lines, body.zone));
      },
    });
    const { user } = await mounted(fetch);
    await user.clear(box());
    await user.click(box());
    await user.paste(STORED_PRESET);
    await user.click(screen.getByRole("button", { name: "Check" }));
    const line = await screen.findByText("Checking\u2026");
    expect(line).toHaveAttribute("role", "status");
    release();
    await vi.waitFor(() =>
      expect(screen.queryByText("Checking\u2026")).not.toBeInTheDocument(),
    );
    await expectNoAxeViolations(document.body);
  });

  it("replaces Checking\u2026 with the error text when the check fails", async () => {
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    let seen = 0;
    const { fetch } = fakeFetch({
      post: async () => {
        if (seen++ > 0) await held;
        return seen > 1
          ? new Response("no", { status: 500 })
          : Response.json(computeStoredCheck(STORED_PRESET, "America/Toronto"));
      },
    });
    const { user } = await mounted(fetch);
    await user.clear(box());
    await user.click(box());
    await user.paste(STORED_PRESET);
    await user.click(screen.getByRole("button", { name: "Check" }));
    await screen.findByText("Checking\u2026");
    release();
    expect(
      await screen.findByText("The check could not finish."),
    ).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("names the reading limit on a 413", async () => {
    const { fetch } = fakeFetch({
      post: () =>
        new Response(JSON.stringify({ error: "x", retryable: false }), {
          status: 413,
        }),
    });
    const { user } = await mounted(fetch);
    await check(user, STORED_PRESET);
    expect(
      await screen.findByText(
        `That is too much text to read. Keep it to ${STORED_MAX_LINES} lines and 20,000 bytes.`,
      ),
    ).toBeInTheDocument();
  });

  it("says the check could not finish on a failure", async () => {
    const { fetch } = fakeFetch({
      post: () => new Response("no", { status: 500 }),
    });
    const { user } = await mounted(fetch);
    await check(user, STORED_PRESET);
    expect(
      await screen.findByText("The check could not finish."),
    ).toBeInTheDocument();
  });

  it("sends nothing but the two form fields, as strings", async () => {
    const { fetch, posts } = fakeFetch();
    const { user } = await mounted(fetch);
    await user.clear(box());
    await user.click(box());
    await user.paste("a");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Lines without a zone use" }),
      "America/Toronto",
    );
    await user.click(screen.getByRole("button", { name: "Check" }));
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    expect(Object.keys(posts.at(-1)!).sort()).toEqual(["lines", "zone"]);
    expect(posts.at(-1)!.zone).toBe("America/Toronto");
  });
});
