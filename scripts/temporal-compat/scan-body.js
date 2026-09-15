/**
 * The Temporal scan the native oracle runs (CORE-6 spec §6.3), promoted from the CORE-6 research
 * scratchpad (`q2-xscan-body.js` + `q2-grid-body.js`). `scripts/temporal-compat.mjs oracle` sends
 * each function's source into a Chromium page with native `Temporal` (`Function#toString`), so every
 * function here must be self-contained: no imports, no references outside its own body.
 *
 * Results are strings; a throw is `"ERR"`. Rows are positional, and the column order is the contract
 * the GMT twin (`runTwin` in `temporal-compat.mjs`) reads.
 */

/**
 * Edge scan: for each calendar, the 421 days next to each limit (reads, fields → ISO, add/subtract a
 * month or a year, `until` in months to the limit and in years to 800 days inside it), plus a stride
 * of reads and arithmetic across the whole range. Grid: `until`/`add` at ordinary dates from
 * 2023-06-01, over the day offsets `K` where month-end and leap-month defects show.
 */
export function scanBody(T) {
  const calendars = [
    "buddhist",
    "hebrew",
    "islamic-civil",
    "islamic-tbla",
    "islamic-umalqura",
    "persian",
    "indian",
    "ethioaa",
    "japanese",
    "roc",
    "gregory",
  ];
  const attempt = (f) => {
    try {
      return String(f());
    } catch {
      return "ERR";
    }
  };
  const iso = (d) => d.withCalendar("iso8601").toString();
  const read = (d) =>
    `${d.year}|${d.monthCode}|${d.month}|${d.day}|${d.monthsInYear}|${d.daysInMonth}`;
  const fromFields = (c, d) =>
    T.PlainDate.from(
      { calendar: c, year: d.year, month: d.month, day: d.day },
      { overflow: "reject" },
    )
      .withCalendar("iso8601")
      .toString();

  const MAX = T.PlainDate.from("+275760-09-13");
  const MIN = T.PlainDate.from("-271821-04-19");
  const EDGE_DAYS = 420;
  const FAR_DAYS = 800;
  const STRIDE_START = 1000;
  const STRIDE_STEP = 99991;
  const STRIDE_END = 199999000;
  const STRIDE_UNTIL_DAYS = 400;

  const xscan = { edge: {}, stride: {} };
  for (const c of calendars) {
    const edges = (xscan.edge[c] = {});
    for (const [tag, edge, dir] of [
      ["max", MAX, -1],
      ["min", MIN, 1],
    ]) {
      const rows = (edges[tag] = []);
      const far = edge.add({ days: dir * FAR_DAYS }).withCalendar(c);
      for (let n = 0; n <= EDGE_DAYS; n++) {
        const d0 = edge.add({ days: dir * n });
        if (attempt(() => d0.withCalendar(c)) === "ERR") {
          rows.push(["ERR"]);
          continue;
        }
        const dc = d0.withCalendar(c);
        rows.push([
          attempt(() => read(dc)),
          attempt(() => fromFields(c, dc)),
          attempt(() => iso(dc.add({ months: 1 }))),
          attempt(() => iso(dc.add({ years: 1 }))),
          attempt(() => iso(dc.subtract({ months: 1 }))),
          attempt(() => iso(dc.subtract({ years: 1 }))),
          attempt(() =>
            dir < 0
              ? dc
                  .until(edge.withCalendar(c), { largestUnit: "months" })
                  .toString()
              : edge
                  .withCalendar(c)
                  .until(dc, { largestUnit: "months" })
                  .toString(),
          ),
          attempt(() =>
            dir < 0
              ? far.until(dc, { largestUnit: "years" }).toString()
              : dc.until(far, { largestUnit: "years" }).toString(),
          ),
        ]);
      }
    }
    const strideRows = (xscan.stride[c] = []);
    for (let k = 0; STRIDE_START + k * STRIDE_STEP <= STRIDE_END; k++) {
      const d0 = MIN.add({ days: STRIDE_START + k * STRIDE_STEP });
      if (attempt(() => d0.withCalendar(c)) === "ERR") {
        strideRows.push([d0.toString(), "ERR"]);
        continue;
      }
      const dc = d0.withCalendar(c);
      strideRows.push([
        d0.toString(),
        attempt(() => read(dc)),
        attempt(() => fromFields(c, dc)),
        attempt(() => iso(dc.add({ months: 1 }))),
        attempt(() => iso(dc.add({ years: 1 }))),
        attempt(() =>
          dc
            .until(d0.add({ days: STRIDE_UNTIL_DAYS }).withCalendar(c), {
              largestUnit: "years",
            })
            .toString(),
        ),
      ]);
    }
  }

  const K = [28, 29, 30, 31, 58, 59, 60, 61, 354, 355, 365, 366, 383, 384, 385];
  const GRID_BASE = "2023-06-01";
  const GRID_DAYS = 400;
  const base = T.PlainDate.from(GRID_BASE);
  const grid = {};
  for (const c of calendars) {
    const rows = (grid[c] = []);
    for (let i = 0; i <= GRID_DAYS; i++) {
      const a = base.add({ days: i }).withCalendar(c);
      const row = [a.toString()];
      for (const k of K) {
        const b = base.add({ days: i + k }).withCalendar(c);
        row.push(
          attempt(() => a.until(b, { largestUnit: "months" })),
          attempt(() => a.until(b, { largestUnit: "years" })),
          attempt(() => b.until(a, { largestUnit: "years" })),
        );
      }
      row.push(
        attempt(() => a.add({ months: 1 }).toString()),
        attempt(() => a.add({ months: 1 }, { overflow: "reject" }).toString()),
        attempt(() => a.add({ years: 1 }).toString()),
        attempt(() => a.subtract({ months: 13 }).toString()),
      );
      rows.push(row);
    }
  }

  return {
    calendars,
    xscan: {
      max: MAX.toString(),
      min: MIN.toString(),
      farDays: FAR_DAYS,
      strideUntilDays: STRIDE_UNTIL_DAYS,
      edge: xscan.edge,
      stride: xscan.stride,
    },
    grid: { base: GRID_BASE, offsets: K, rows: grid },
  };
}

/**
 * Native field reads for `[isoDate, calendar]` pairs: `year|month|day|era|eraYear`, or `"ERR"`. The
 * GMT twin turns them into the calendar string a GMT function should return for that ISO date.
 */
export function readDates(T, pairs) {
  return pairs.map(([isoDate, calendar]) => {
    try {
      const d = T.PlainDate.from(isoDate).withCalendar(calendar);
      return `${d.year}|${d.month}|${d.day}|${d.era ?? ""}|${d.eraYear ?? ""}`;
    } catch {
      return "ERR";
    }
  });
}
