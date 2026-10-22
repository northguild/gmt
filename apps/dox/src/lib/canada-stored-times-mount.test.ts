/**
 * @vitest-environment jsdom
 *
 * "Check saved times" in the checker's mount. The Worker's answer is built by the real
 * Worker code in this test runtime, so every row is the library's own reading here.
 */
import { getUtcNow } from "@northguild/gmt/utc/get";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  computeCanadaCheck,
  computeStoredCheck,
} from "../../worker/canada-clock-change";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  STORED_PRESET,
  storedFix,
  storedVerdict,
} from "./canada-stored-times";
import { SAVED_EXAMPLE } from "./canada-saved-example";
import { STORED_MAX_LINES } from "./canada-clock-change";
import {
  mountCanadaClockChange,
  renderCanadaClockChangeTemplate,
  STORED_EXAMPLE,
  storedTruncatedText,
} from "./canada-clock-change-mount";

installJsdomShims();

const NOW = "2026-10-22T12:00:00Z";

type Posted = { lines: string; zone: string };

/** `stale` names zones the mocked checking data has wrong: they come back as ones that still change. */
function fakeFetch(
  options: { post?: (body: Posted) => Response; stale?: string[] } = {},
): {
  fetch: typeof fetch;
  posts: Posted[];
} {
  const posts: Posted[] = [];
  const impl = async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      const form = init.body as FormData;
      const body = {
        lines: String(form.get("lines")),
        zone: String(form.get("zone")),
      };
      posts.push(body);
      return (
        options.post?.(body) ??
        Response.json(computeStoredCheck(body.lines, body.zone))
      );
    }
    const check = computeCanadaCheck(NOW);
    const stale = new Set(options.stale ?? []);
    const fresh = new Set(["America/Vancouver", "America/Edmonton", "America/Inuvik", "America/Winnipeg"]);
    // Mocked data: the zones that stop changing are right unless the test names them stale.
    const zones = check.zones.map((zone) =>
      fresh.has(zone.zone)
        ? { ...zone, kind: stale.has(zone.zone) ? ("changes-2027" as const) : ("stopped-2026" as const) }
        : zone,
    );
    return Response.json({ ...check, zones });
  };
  return { fetch: impl as unknown as typeof fetch, posts };
}

async function mounted(fetchFn: typeof fetch) {
  document.body.innerHTML = renderCanadaClockChangeTemplate();
  const root = document.querySelector<HTMLElement>(".gmt-canada")!;
  const controller = new AbortController();
  await mountCanadaClockChange(root, controller.signal, {
    fetch: fetchFn,
    now: getUtcNow,
  });
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector<T>(`[data-role="${role}"]`)!;
  return { root, controller, q };
}

async function submit(
  q: <T extends HTMLElement>(role: string) => T,
  lines: string,
): Promise<void> {
  q<HTMLTextAreaElement>("stored-lines").value = lines;
  q<HTMLButtonElement>("stored-check").click();
  await vi.waitFor(() =>
    expect(q("stored-check").getAttribute("aria-busy")).toBeNull(),
  );
}

const text = (el: Element | null) => el?.textContent?.trim() ?? "";

const rowsOf = (root: Element) => [
  ...root.querySelectorAll<HTMLElement>(".gmt-canada-stored-table tbody tr"),
];

describe("the saved-times example", () => {
  it("states what the library says about the saved Vancouver value", () => {
    // The library types the result as a union; the page reads the row shape `storedFix` takes.
    const result = classifyStoredZoned(SAVED_EXAMPLE.saved) as unknown as
      | (Parameters<typeof storedFix>[1] & { kind: string; storedOffset?: string; zoneOffset?: string })
      | null;
    // Runtime data decides the verdict; a runtime older than the change reads it as valid.
    if (result !== null && result.kind === "offsetMismatch") {
      expect(result.storedOffset).toBe(SAVED_EXAMPLE.savedOffset);
      expect(result.zoneOffset).toBe(SAVED_EXAMPLE.newOffset);
      expect(SAVED_EXAMPLE.fixed).toBe(
        SAVED_EXAMPLE.saved.replace(SAVED_EXAMPLE.savedOffset, SAVED_EXAMPLE.newOffset),
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
  it("is server-rendered with its purpose, three steps, labelled form and compact controls", () => {
    document.body.innerHTML = renderCanadaClockChangeTemplate();
    const section = document.querySelector(".gmt-canada-stored")!;
    expect(text(section.querySelector("h4"))).toBe("Did your saved appointments move?");
    expect(text(section.querySelector(".gmt-canada-stored-lead"))).toBe(
      "Apps often save a future event with the UTC offset that applied when it was booked. Where the rules changed, that saved offset is wrong, and the app shows the event an hour off.",
    );
    const steps = [...section.querySelectorAll(".gmt-canada-step")].map((el) => text(el));
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain("Booked before the change");
    expect(steps[0]).toContain("9:00, 15 Nov, Vancouver, saved as 09:00 −08:00");
    expect(steps[1]).toContain("Vancouver stays on −07:00");
    expect(steps[2]).toContain("The saved time shows as 10:00.");
    expect(steps[2]).toContain("Fix: store 09:00 −07:00");
    const textarea = section.querySelector("textarea")!;
    expect(textarea.rows).toBe(8);
    expect(textarea.value).toBe(STORED_EXAMPLE);
    expect(text(section.querySelector("label[for]"))).toBe("Saved times, one per line");
    expect(text(section.querySelector(".gmt-canada-stored-help"))).toBe(
      `Paste values like ${SAVED_EXAMPLE.saved}. Up to ${STORED_MAX_LINES} lines.`,
    );
    expect(text(section.querySelector(".gmt-canada-formats summary"))).toBe("Accepted formats");
    // Every line has its own zone, so the picker stays out of the way.
    expect(section.querySelector<HTMLElement>('[data-role="stored-zone-row"]')!.hidden).toBe(true);
    expect(text(section.querySelector('[data-role="stored-check"]'))).toBe("Check");
    expect(text(section.querySelector('[data-role="stored-example"]'))).toBe("Reset example");
    expect(section.textContent).not.toMatch(/Worker|workerd/);
  });

  it("shows the zone picker only when a line has no zone", async () => {
    const { fetch } = fakeFetch();
    const { q, controller } = await mounted(fetch);
    const row = q<HTMLElement>("stored-zone-row");
    expect(row.hidden).toBe(true);
    const lines = q<HTMLTextAreaElement>("stored-lines");
    lines.value = "2026-11-15T09:00:00-08:00";
    lines.dispatchEvent(new Event("input"));
    expect(row.hidden).toBe(false);
    expect(
      [...row.querySelectorAll("option")].map((o) => o.getAttribute("value")),
    ).toEqual([
      "America/Vancouver",
      "America/Edmonton",
      "America/Inuvik",
      "America/Winnipeg",
      "America/Toronto",
    ]);
    controller.abort();
  });

  it("with fresh data: normal verdicts, a summary and a copyable fix", async () => {
    const { fetch, posts } = fakeFetch();
    const { q, root, controller } = await mounted(fetch);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.lines).toBe(STORED_EXAMPLE);
    const rows = rowsOf(root);
    expect(rows).toHaveLength(4);
    expect(q("stored-stale").hidden).toBe(true);
    const pills = rows.map((r) => text(r.querySelector(".gmt-canada-badge")));
    expect(pills[1]).toBe("✓ Still right");
    expect(pills[2]).toBe("✓ Still right");
    // Vancouver 09:00-08:00 is an hour off whenever this host's data has the 2026e rule.
    const vancouverMoved = rows[0]!.dataset.ok === "false";
    if (vancouverMoved) {
      expect(pills[0]).toBe("✗ Shows 1 h off");
      const says = rows[0]!.querySelector(".gmt-canada-stored-says")!;
      expect(text(says)).toContain(
        `Keep 9:00 local: store ${SAVED_EXAMPLE.fixed}`,
      );
      expect(text(says)).toContain("Or keep the old instant (that is 10:00 local).");
      expect(
        says.querySelector<HTMLElement>('[data-role="stored-copy"]')!.dataset.copyText,
      ).toBe(SAVED_EXAMPLE.fixed);
      expect(text(q("stored-summary"))).toMatch(/^4 checked \u00b7 (\d moved|none moved)$/);
    }
    expect(rows[0]!.querySelector(".gmt-canada-stored-input code")!.getAttribute("title")).toBe(
      SAVED_EXAMPLE.saved,
    );
    controller.abort();
  });

  it("with stale data: no tick, no cross and no advice on the affected lines; the others keep theirs", async () => {
    const { fetch } = fakeFetch({ stale: ["America/Vancouver", "America/Winnipeg"] });
    const { q, root, controller } = await mounted(fetch);
    const rows = rowsOf(root);
    for (const i of [0, 3]) {
      const row = rows[i]!;
      expect(text(row.querySelector(".gmt-canada-badge"))).toBe("Can’t check yet");
      expect(row.dataset.ok).toBe("unknown");
      expect(row.textContent).not.toMatch(/[✓✗]/);
      expect(row.querySelector('[data-role="stored-copy"]')).toBeNull();
      expect(row.querySelector("details")).toBeNull();
      expect(row.querySelector("a")).toBeNull();
      // The sentence is said once, in the summary bar; a row only says to try again.
      expect(text(row.querySelector(".gmt-canada-stored-says"))).toBe("Try again after the update.");
    }
    expect(text(q("stored-stale"))).toBe(
      "This check\u2019s time zone data is older than the change for Vancouver and Winnipeg, so it can\u2019t tell. Try again later, or run the command in Test your own servers.",
    );
    expect(root.querySelector(".gmt-canada-stored-table")!.textContent).not.toContain("older than the change");
    // Toronto is not affected: it keeps its verdict.
    expect(text(rows[2]!.querySelector(".gmt-canada-badge"))).toBe("✓ Still right");
    expect(q("stored-stale").hidden).toBe(false);
    expect(text(q("stored-stale"))).toContain("Vancouver");
    expect(text(q("stored-summary"))).toBe("1 checked \u00b7 none moved \u00b7 3 can\u2019t be checked yet");
    controller.abort();
  });

  it("puts the example back and checks it again on Reset example", async () => {
    const { fetch, posts } = fakeFetch();
    const { q, controller } = await mounted(fetch);
    q<HTMLTextAreaElement>("stored-lines").value = "x";
    q<HTMLButtonElement>("stored-example").click();
    expect(q<HTMLTextAreaElement>("stored-lines").value).toBe(STORED_EXAMPLE);
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    controller.abort();
  });

  it("marks every line with a pill and a plain verdict", async () => {
    const { fetch, posts } = fakeFetch();
    const { q, root, controller } = await mounted(fetch);
    await submit(q, `${STORED_PRESET}\nnot a stored time`);
    expect(posts.at(-1)).toEqual({
      lines: `${STORED_PRESET}\nnot a stored time`,
      zone: "America/Vancouver",
    });
    const rows = rowsOf(root);
    expect(rows.map((r) => r.dataset.kind).slice(0, 5)).toEqual([
      "valid",
      "validInOverlap",
      "offsetMismatch",
      "ambiguous",
      "nonexistent",
    ]);
    rows.slice(0, 8).forEach((row) => {
      expect(row.querySelector(".gmt-canada-badge")).not.toBeNull();
      expect(row.querySelector("details")).not.toBeNull();
    });
    const none = rows[8]!;
    expect(none.dataset.kind).toBe("none");
    expect(none.innerHTML).toContain("gmt-playground-sentinel");
    expect(none.querySelector("details")).toBeNull();
    controller.abort();
  });

  it("words a moved Vancouver meeting as the local time it now means", () => {
    expect(
      storedVerdict({
        kind: "offsetMismatch",
        zoneOffset: "-07:00",
        atStoredOffset: "2026-11-15T17:00:00Z",
      }),
    ).toEqual({ ok: false, words: "Moved: shows 10:00 local" });
    expect(storedVerdict({ kind: "valid" })).toEqual({ ok: true, words: "Still correct" });
    expect(storedVerdict({ kind: "ambiguous" }).ok).toBe(false);
  });

  it("shows only the moved rows when the toggle says so, and all again", async () => {
    const { fetch } = fakeFetch();
    const { q, root, controller } = await mounted(fetch);
    await submit(q, STORED_PRESET);
    const rows = () => [...root.querySelectorAll<HTMLElement>("tbody tr")];
    q<HTMLButtonElement>("stored-show-moved").click();
    expect(q("stored-show-moved").getAttribute("aria-pressed")).toBe("true");
    expect(rows().filter((r) => !r.hidden).map((r) => r.dataset.ok)).not.toContain("true");
    expect(rows().some((r) => r.hidden)).toBe(true);
    q<HTMLButtonElement>("stored-show-all").click();
    expect(rows().every((r) => !r.hidden)).toBe(true);
    controller.abort();
  });

  it("tells the reader when the toggle leaves no line", async () => {
    const { fetch } = fakeFetch();
    const { q, root, controller } = await mounted(fetch);
    await submit(q, "2026-07-01T12:00:00-04:00[America/Toronto]");
    q<HTMLButtonElement>("stored-show-moved").click();
    expect(root.querySelector<HTMLElement>('[data-role="stored-none"]')!.hidden).toBe(false);
    controller.abort();
  });

  it("names the last row's line in the truncated message", async () => {
    const many = Array.from({ length: STORED_MAX_LINES + 5 }, () => "x").join("\n");
    const { fetch } = fakeFetch();
    const { q, controller } = await mounted(fetch);
    await submit(q, many);
    expect(text(q("stored-truncated"))).toBe(
      `The input was over ${STORED_MAX_LINES} lines or 20,000 bytes; lines after line ${STORED_MAX_LINES} were not read.`,
    );
    expect(
      storedTruncatedText({ zone: "America/Toronto", truncated: true, rows: [] }),
    ).toContain("no line was read");
    controller.abort();
  });

  it("clears the truncated message on the next answer", async () => {
    const { fetch } = fakeFetch();
    const { q, controller } = await mounted(fetch);
    await submit(q, Array.from({ length: 205 }, () => "x").join("\n"));
    await submit(q, "2026-07-01T12:00:00-04:00[America/Toronto]");
    expect(text(q("stored-truncated"))).toBe("");
    controller.abort();
  });

  it("says nothing was found for empty input", async () => {
    const { fetch } = fakeFetch();
    const { q, controller } = await mounted(fetch);
    await submit(q, "  \n");
    expect(text(q("stored-results"))).toContain("Nothing to check");
    controller.abort();
  });

  it("says when to try again on a 429", async () => {
    const { fetch } = fakeFetch({
      post: () =>
        new Response(JSON.stringify({ error: "x", retryable: true }), {
          status: 429,
          headers: { "retry-after": "42" },
        }),
    });
    const { q, controller } = await mounted(fetch);
    await submit(q, STORED_PRESET);
    expect(text(q("stored-status"))).toBe("Try again in 42 s");
    controller.abort();
  });

  it("names the reading limit on a 413", async () => {
    const { fetch } = fakeFetch({
      post: () =>
        new Response(JSON.stringify({ error: "x", retryable: false }), { status: 413 }),
    });
    const { q, controller } = await mounted(fetch);
    await submit(q, STORED_PRESET);
    expect(text(q("stored-status"))).toBe(
      `That is too much text to read. Keep it to ${STORED_MAX_LINES} lines and 20,000 bytes.`,
    );
    controller.abort();
  });

  it("says the check could not finish on a failure", async () => {
    const { fetch } = fakeFetch({ post: () => new Response("no", { status: 500 }) });
    const { q, controller } = await mounted(fetch);
    await submit(q, STORED_PRESET);
    expect(text(q("stored-status"))).toBe("The check could not finish.");
    controller.abort();
  });

  it("sends nothing but the two form fields, as strings", async () => {
    const { fetch, posts } = fakeFetch();
    const { q, controller } = await mounted(fetch);
    q<HTMLSelectElement>("stored-zone").value = "America/Toronto";
    await submit(q, "a");
    expect(Object.keys(posts.at(-1)!).sort()).toEqual(["lines", "zone"]);
    expect(posts.at(-1)!.zone).toBe("America/Toronto");
    controller.abort();
  });
});
