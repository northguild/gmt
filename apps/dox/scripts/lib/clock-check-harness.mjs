/**
 * What the dated clock-change checkers' browser gates share (CORE-89): the region of a page path,
 * the Worker stub that answers by method, and the wait for the page's own ready signal.
 *
 * It imports nothing, so `clock-check-harness.test.ts` runs it without a browser.
 *
 * The ready signal is `data-state` on the page's root (`canada-clock-change` or `morocco-clock-change`): the mount
 * sets `ready` right after the first clock tick that has the Worker's answer and `error` where it
 * shows its error state. A gate waits for it instead of guessing from readout text, so a slow
 * module chunk, library import or routed fetch on a busy machine cannot make it measure too soon.
 */

/** Real time a page may take to reach `ready`, on a busy machine. */
export const READY_MS = 60_000;

/** The page's root element, whichever checker it is. */
export const ROOT_SELECTOR =
  '[data-widget="canada-clock-change"], [data-widget="morocco-clock-change"]';

/** One entry per checker page, keyed by its path. An unknown path throws: it gets no default. */
export const REGIONS = {
  "/check/canada-2026-clock-change/": {
    name: "canada",
    route: "**/api/canada-clock-change",
    zonesFile: "canada-zones.json",
    clockCount: 5,
    storedZone: "America/Vancouver",
  },
  "/check/morocco-2026-clock-change/": {
    name: "morocco",
    route: "**/api/morocco-clock-change",
    zonesFile: "morocco-region-zones.json",
    clockCount: 2,
    storedZone: "Africa/Casablanca",
  },
};

export function regionOf(path) {
  const region = REGIONS[path];
  if (!region) {
    throw new Error(
      `no checker page at "${path}" (known: ${Object.keys(REGIONS).join(", ")})`,
    );
  }
  return region;
}

const CANADA_OFFSETS = {
  "America/Vancouver": "-07:00",
  "America/Edmonton": "-06:00",
  "America/Inuvik": "-06:00",
  "America/Winnipeg": "-05:00",
};

/**
 * Canada's Worker answer for a gate: the four zones that stopped and Toronto, which turns its
 * clock back at `2026-11-01T06:00:00Z`. `now` is the Worker's clock in the answer.
 */
export function canadaGetFixture(now) {
  return {
    now,
    probe: Object.entries(CANADA_OFFSETS).map(([zone, offset]) => ({
      zone,
      offset,
    })),
    transitions: [],
    zones: [
      ...Object.entries(CANADA_OFFSETS).map(([zone, offset]) => ({
        zone,
        offset,
        last: null,
        next: null,
        kind: "stopped",
      })),
      {
        zone: "America/Toronto",
        offset: "-04:00",
        last: null,
        next: {
          instant: "2026-11-01T06:00:00Z",
          offsetBefore: "-04:00",
          offsetAfter: "-05:00",
        },
        kind: "changes-after",
      },
    ],
  };
}

const ROW = (line, input, result) => ({ line, input, value: input, result });

/** The saved-times answer: one row of every kind and a line that is not a time. */
export function storedFixture(zone) {
  return {
    zone,
    truncated: true,
    rows: [
      ROW(1, "2026-07-01T12:00:00-04:00[America/Toronto]", {
        kind: "valid",
        instant: "2026-07-01T16:00:00Z",
        atStoredOffset: "2026-07-01T16:00:00Z",
      }),
      ROW(2, "2026-11-01T01:30:00-04:00[America/Toronto]", {
        kind: "validInOverlap",
        instant: "2026-11-01T05:30:00Z",
        earlier: "2026-11-01T05:30:00Z",
        later: "2026-11-01T06:30:00Z",
        atStoredOffset: "2026-11-01T05:30:00Z",
      }),
      ROW(3, "2026-07-01T12:00:00-05:00[America/Toronto]", {
        kind: "offsetMismatch",
        storedOffset: "-05:00",
        zoneOffset: "-04:00",
        atStoredOffset: "2026-07-01T17:00:00Z",
        atZoneOffset: "2026-07-01T16:00:00Z",
      }),
      ROW(4, "2026-11-01T01:30:00-06:00[America/Toronto]", {
        kind: "ambiguous",
        earlier: "2026-11-01T05:30:00Z",
        later: "2026-11-01T06:30:00Z",
        atStoredOffset: "2026-11-01T07:30:00Z",
      }),
      ROW(5, "2027-03-14T02:30:00-05:00[America/Toronto]", {
        kind: "nonexistent",
        earlier: "2027-03-14T06:30:00Z",
        later: "2027-03-14T07:30:00Z",
        atStoredOffset: "2027-03-14T07:30:00Z",
      }),
      { line: 6, input: "not a stored time", value: null, result: null },
    ],
  };
}

/** The text of the `lines` field in a multipart or url-encoded POST body, or null. */
export function linesOfBody(body) {
  const multipart = /name="lines"\r?\n\r?\n([\s\S]*?)\r?\n--/.exec(body ?? "");
  if (multipart) return multipart[1];
  const encoded = /(?:^|&)lines=([^&]*)/.exec(body ?? "");
  return encoded ? decodeURIComponent(encoded[1].replace(/\+/g, " ")) : null;
}

/**
 * A saved-times answer with one row for each line the page sent, so the table is as tall as the
 * page's own example makes it: the first line moved, the rest fine.
 */
export function echoFixture(zone, body) {
  const lines = (linesOfBody(body) ?? "")
    .split(/\r?\n/)
    .filter((l) => l !== "");
  return {
    zone,
    truncated: false,
    rows: lines.map((input, i) =>
      ROW(
        i + 1,
        input,
        i === 0
          ? {
              kind: "offsetMismatch",
              storedOffset: "-08:00",
              zoneOffset: "-07:00",
              atStoredOffset: "2026-11-15T17:00:00Z",
              atZoneOffset: "2026-11-15T16:00:00Z",
            }
          : {
              kind: "valid",
              instant: "2026-11-15T16:00:00Z",
              atStoredOffset: "2026-11-15T16:00:00Z",
            },
      ),
    ),
  };
}

/** The error answers the Worker gives: a 503 for a fault and a 429 with `Retry-After`. */
export const ERROR_ANSWERS = {
  503: { status: 503, headers: {}, body: { error: "unavailable" } },
  429: {
    status: 429,
    headers: { "retry-after": "42" },
    body: { error: "rate-limited" },
  },
};

/**
 * Stubs the region's Worker route by method: GET gets `getFixture` (or the error answer for
 * `getStatus`), POST gets the saved-times fixture. With `hold`, the GET waits for `release()`, so
 * a gate can measure the page before any answer. `post: "echo"` answers a POST with a row for
 * each line sent, as the page's own example would; the default is the fixed six-row answer.
 * Returns `{ release }`.
 */
export async function routeWorker(
  page,
  region,
  { getFixture, getStatus = 200, hold = false, post = "fixed" },
) {
  let release = () => {};
  const gate = hold ? new Promise((resolve) => (release = resolve)) : null;
  await page.route(region.route, async (route) => {
    const headers = { "cache-control": "no-store" };
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify(
          post === "echo"
            ? echoFixture(region.storedZone, route.request().postData())
            : storedFixture(region.storedZone),
        ),
      });
    }
    if (gate) await gate;
    const error = ERROR_ANSWERS[getStatus];
    return route.fulfill({
      status: error ? error.status : 200,
      contentType: "application/json",
      headers: { ...headers, ...error?.headers },
      body: JSON.stringify(error ? error.body : getFixture),
    });
  });
  return { release };
}

/**
 * Waits for the page's `data-state` to be one of `states`, in real time (`READY_MS`), and fails
 * with the state it saw. Polling by interval, not by animation frame: a gate's fake clock may be
 * paused, and `requestAnimationFrame` would then never fire.
 */
export async function waitForState(page, states = ["ready"]) {
  try {
    await page.waitForFunction(
      ([selector, wanted]) =>
        wanted.includes(document.querySelector(selector)?.dataset.state),
      [ROOT_SELECTOR, states],
      { timeout: READY_MS, polling: 50 },
    );
  } catch {
    const seen = await page
      .evaluate(
        (selector) => document.querySelector(selector)?.dataset.state,
        ROOT_SELECTOR,
      )
      .catch(() => "unreadable");
    throw new Error(
      `the page never reached data-state ${states.join(" or ")} in ${READY_MS / 1000} s; it saw ${seen === undefined ? "no data-state" : `"${seen}"`}`,
    );
  }
  return page.evaluate(
    (selector) => document.querySelector(selector).dataset.state,
    ROOT_SELECTOR,
  );
}
