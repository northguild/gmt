# Slice 1 · The leap-second preset

One read preset, its prose and its tests. Binding rules:
[built/index.md](../../built/index.md) and
[tier-2-tools.md § Rail and IoT tools](../../built/tier-2-tools.md#rail-and-iot-tools-gtfs-ptp).
In particular, range numbers live only in the preset file, and a page link to a preset carries
`preset` alone.

## The preset

Append it to `READ_PRESETS` in `apps/dox/src/lib/ptp-clock-presets.ts`, **after `before-1972`**:

```ts
{
  id: "leap-2016",
  label: "Inside a leap second",
  description: "The 2016 inserted second: the check is 1 s out.",
  seconds: "1483228836",
  nanoseconds: "0",
  offset: "36",
},
```

- **Label:** 20 characters. The longest label already in the list is "Offset 37, as announced" (23).
- **Description:** 47 characters. The longest already in the list is "The leap-second table has no
  whole-second value." (48). `gmt-preset` reserves the height of its widest description through
  ghost spans, so a longer one would push down everything below it, on every preset.
- Do not change the default (`READ_PRESETS[0]`), and do not reorder the list: the parity test reads
  it by position.

## Verified readings

`@js-temporal/polyfill` 0.5.1 (`apps/dox/node_modules`), library from `packages/gmt/src`, run from
`apps/dox` with `./node_modules/.bin/tsx verify.mts`:

```ts
import { createRequire } from "node:module";
const W = "<worktree>";
const { Temporal } = createRequire(`${W}/apps/dox/package.json`)("@js-temporal/polyfill");
const conv = await import(`${W}/packages/gmt/src/iot/convert/index.ts`);
const val = await import(`${W}/packages/gmt/src/iot/validate/index.ts`);
const { taiMinusUtc } = await import(`${W}/packages/gmt/src/timescale/calculate/index.ts`);
const t = await import(`${W}/apps/dox/src/lib/ptp-clock-converter.ts`);
const lib = { ...conv, ...val, taiMinusUtc };
const seconds = 1483228836n, nanoseconds = 0;
console.log("step epoch s =", Temporal.Instant.from("2017-01-01T00:00:00Z").epochNanoseconds / 10n ** 9n);
for (const off of [36n, 37n, 0n]) {
  const polyfill = Temporal.Instant.fromEpochNanoseconds((seconds - off) * 10n ** 9n + BigInt(nanoseconds)).toString();
  const lib_ = conv.ptpToUtc({ seconds, nanoseconds }, Number(off));
  console.log(`offset ${off}: polyfill ${polyfill} | ptpToUtc ${lib_} | taiMinusUtc ${taiMinusUtc(lib_)}`);
}
console.log("isValidPtpTimestamp", val.isValidPtpTimestamp({ seconds, nanoseconds }));
for (const offset of ["36", "37"]) {
  const r = t.readPtp(lib, { seconds: String(seconds), nanoseconds: String(nanoseconds), offset, instant: "" });
  const c = t.checkOffset(lib, r);
  console.log(`tool offset ${offset}: utc ${r.utc}, ignored ${r.ignored}, table ${c.table}, tableUtc ${c.tableUtc}, verdict ${c.verdict.title} / ${c.verdict.detail}`);
}
```

Output:

```text
step epoch s = 1483228800n
offset 36: polyfill 2017-01-01T00:00:00Z | ptpToUtc 2017-01-01T00:00:00Z | taiMinusUtc 37
offset 37: polyfill 2016-12-31T23:59:59Z | ptpToUtc 2016-12-31T23:59:59Z | taiMinusUtc 36
offset 0: polyfill 2017-01-01T00:00:36Z | ptpToUtc 2017-01-01T00:00:36Z | taiMinusUtc 37
isValidPtpTimestamp true
tool offset 36: utc 2017-01-01T00:00:00Z, ignored 2017-01-01T00:00:36Z, table 37, tableUtc 2016-12-31T23:59:59Z, verdict Offset differs from the table by 1 s / Every reading is 1 s later than UTC
tool offset 37: utc 2016-12-31T23:59:59Z, ignored 2017-01-01T00:00:36Z, table 36, tableUtc 2017-01-01T00:00:00Z, verdict Offset differs from the table by 1 s / Every reading is 1 s earlier than UTC
```

**Why this count, and not one after the step.** UTC 2016-12-31T23:59:59Z is epoch second
1483228799 with TAI − UTC = 36, so its PTP count is 1483228835. The inserted 23:59:60 is
1483228836, and 2017-01-01T00:00:00Z (offset 37) is 1483228837. For a count `c`, the reading at
37 falls before the step, so the table says 36, when `c < 1483228837`. The reading at 36 falls on
or after the step, so the table says 37, when `c ≥ 1483228836`. Only `[1483228836, 1483228837)`,
the inserted second itself, makes the table disagree with both offsets. A count after the step
gives a match at 37 and a correct 1 s warning at 36, which shows nothing new. `taiMinusUtc`'s own
JSDoc gives 36 for `2016-12-31T23:59:60Z`, and `ptpToUtc`'s says it "never writes a second of
`60`", which is why the reading at 36 lands on 00:00:00.

What the preset shows: UTC `2017-01-01T00:00:00Z`; offset ignored `2017-01-01T00:00:36Z`; record
in range; Table offset `37 s`; Table reading `2016-12-31T23:59:59Z`; verdict "Offset differs from
the table by 1 s" / "Every reading is 1 s later than UTC"; the ruler marks 36 and 37, "1 s apart".

## Prose

`apps/dox/src/content/docs/tools/ptp-clock-converter.mdx`:

- **The check.** After "…an announced offset of 36 shows as 1 s apart on the ruler." insert:
  "Inside the second inserted at the end of 2016 it is out either way. The count 1483228836 read
  with 36 is 2017-01-01T00:00:00Z, where the table says 37, and read with 37 it is
  2016-12-31T23:59:59Z, where the table says 36." Keep the paragraph on one line, as the page
  already does.
- **Worth trying.** Before "and [a clock that was never set]…" insert
  `[a count inside the 2016 leap second](/tools/ptp-clock-converter/?w=ptpclock&wa=%7B%22preset%22%3A%22leap-2016%22%7D) is 1 s out at 36, and [the same count at 37](/tools/ptp-clock-converter/?w=ptpclock&wa=%7B%22seconds%22%3A%221483228836%22%2C%22nanoseconds%22%3A%220%22%2C%22offset%22%3A%2237%22%7D) is 1 s out the other way;`.
  The second link is typed text, not a preset plus an override, because a preset link carries
  `preset` alone. It opens with the select on "Your values".

`apps/dox/src/content/docs/guides/industries/iot-ptp-time.mdx`: in "…read with the correct
offset of `36`, shows it.", make "shows it" the preset link (the `leap-2016` href above). Change
nothing else in the guide. Rewrap to the guide's line width and run `pnpm run format:fix` on
both files.

The code block on the tool page stays as it is. The guide already pastes this record's calls.

## Tests

`src/lib/ptp-clock-converter.test.ts`:

- Add `"leap-2016": { utc: "2017-01-01T00:00:00Z", ignored: "2017-01-01T00:00:36Z", valid: true }`
  to the `expected` map. The `it.each(READ_PRESETS…)` already runs every preset, and without the
  entry it fails on `expected[id]!`.
- In "the check": `check("leap-2016")` has table `37`, tableUtc `"2016-12-31T23:59:59Z"` and verdict
  `differenceVerdict(36, 37)`. The same record with `offset: "37"` has table `36`, tableUtc
  `"2017-01-01T00:00:00Z"` and detail "Every reading is 1 s earlier than UTC".
- One polyfill oracle, independent of the library:
  `Temporal.Instant.fromEpochNanoseconds((1483228836n - 36n) * 1_000_000_000n).toString()` is
  `"2017-01-01T00:00:00Z"`, and at `37n` it is `"2016-12-31T23:59:59Z"`. Import `Temporal` from
  `@js-temporal/polyfill`. This is the check the issue asks for, kept in the suite.

`src/lib/ptp-clock-converter-prose.test.ts`:

- **The leap-second sentences:** `ptpToUtc(leap, 36)` is `"2017-01-01T00:00:00Z"` and
  `taiMinusUtc` of it is `37`. `ptpToUtc(leap, 37)` is `"2016-12-31T23:59:59Z"` and `taiMinusUtc`
  of it is `36`. The page contains both inserted sentences verbatim. `leap` is
  `{ seconds: 1483228836n, nanoseconds: 0 }`, and `READ_PRESETS`' `leap-2016` matches it
  (`seconds: "1483228836"`, `nanoseconds: "0"`, `offset: "36"`), so the prose and the preset
  cannot drift apart.
- **The permalinks:** every `?w=ptpclock&wa=%7B%22(preset|writePreset)%22%3A%22<id>%22` link in
  the tool page and in the guide names an id in `READ_PRESETS` or `WRITE_PRESETS` respectively,
  and `leap-2016` is among them. The pattern is the one in `gtfs-time-reader-prose.test.ts`. The
  text link decodes (`decodeWidgetPermalink`), `readArgs` of its args gives seconds `1483228836`,
  nanoseconds `0` and offset `37`, and `matchReadPreset` of that state is `"custom"`.

`scripts/ptp-clock-converter-holds.browser.test.ts`: import `READ_PRESETS` and `WRITE_PRESETS`
from `../src/lib/ptp-clock-presets` (no DOM, no library import, as `sunshine-protection-act-holds`
does with its data). Right after `readIds` and `writeIds` are read, assert
`expect(readIds).toEqual(READ_PRESETS.map((p) => p.id))`, and the same for the write presets. The
loop already steps every option on the page. This assertion makes "every preset" mean the list in
source, so a preset missing from the select fails the test. No new hold.

**Asynchronous lifetimes:** the pure and prose tests start nothing. The holds test already
closes its page in `finally` and its browser in `afterAll`. The new assertions run inside that
`try`, so a failure still tears down. No timers, no real-time sleeps added.

## Traps

- **The holds test skips without `dist`** (`distDirOrSkip`). A skip reports as passing. Build
  `packages/gmt`, then the site, before running it, and confirm the run shows the four widths
  executed, not skipped.
- **Do not put the count or offset in the tool code** (`ptp-clock-converter.ts`, `-mount.ts`):
  only the preset file holds numbers. "no range lives in the site" does not catch `1483228836`,
  so do not rely on it.
- **Plain English** in the prose ([plain-english](../../../../.agents/skills/plain-english/SKILL.md)):
  no "simply", no em dash in the page sentences.
- No mount, WebMCP, chat-schema or `CHAT_STARTERS` edit. If one seems needed, stop and report.

## Definition of done

- [ ] `leap-2016` is the last entry of `READ_PRESETS`, exactly as above. The default and the
      existing order are unchanged.
- [ ] `pnpm --filter dox exec vitest run src/lib/ptp-clock-converter src/lib/widget-permalink.test.ts src/lib/webmcp/parity-readers.test.ts`
      passes (run `pnpm --filter dox run generate` first if `src/generated` is missing).
- [ ] `pnpm --filter @northguild/gmt run build && pnpm --filter dox run build`, then
      `pnpm --filter dox exec vitest run -c vitest.browser.config.ts scripts/ptp-clock-converter-holds.browser.test.ts`
      passes with all widths **run** (Chromium and WebKit; Firefox is CI's).
- [ ] Bounding boxes, in the built page at 300, 390 and 1280 px: the read Preset's description cell
      has the same height with `leap-2016` selected as with `announced-37` (±0.5 px), and the
      `leap-2016` ghost span is no taller than the tallest of the other read ghosts. The holds
      test's paragraph diff covers the first check. The tester measures the second with Playwright.
- [ ] By eye, at 1280 px: picking "Inside a leap second" shows the plates listed under "What the
      preset shows". The prose's second Worth-trying link opens with offset 37, Table offset
      `36 s`, Table reading `2017-01-01T00:00:00Z`, and the select on "Your values". The guide's
      "shows it" opens the preset.
- [ ] `pnpm --filter dox gates --no-build` (diff-selected: `readout-still`, a11y and links for the
      two pages) is green.
- [ ] `pnpm --filter dox run check`, `pnpm --filter dox run lint`, `pnpm run format`, and
      `pnpm run validate` are green. No file under `packages/` changed, so there is no changeset.
- [ ] Close-out: read the PTP bullets in `context/dox/built/tier-2-tools.md`. If any sentence no
      longer holds, fix it in the present tense. Otherwise leave the file alone. Do not touch
      `tracker.md`.
