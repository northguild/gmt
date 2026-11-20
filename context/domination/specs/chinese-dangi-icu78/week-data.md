# Phase 3b — D36: locale week data, one value on every host

Read with [index.md](index.md). Applies compat README rule 7 (one value on every host).

## Authority

| Rule | Source |
| --- | --- |
| `firstDay` and `weekend` come from the locale's region in the CLDR week data | ECMA-402 Intl Locale Info, WeekInfoOfLocale; UTS #35 Part 4 § 4 (Week Data), `supplementalData.xml` `<weekData>` |
| A region with no entry uses `001` (firstDay mon, weekend sat–sun) | UTS #35 Part 4 § 4; `<weekendStart territories="001">` |
| `-u-fw-` overrides the first day; values `mon`…`sun` | UTS #35 Part 1 § 3.6.4 (key `fw`); ECMA-402 Intl Locale Info (`firstDayOfWeek`) |
| `-u-rg-` gives the region for regional preferences | UTS #35 Part 1 § 3.6.5 (key `rg`) |
| A deprecated region code is replaced by its successor when the tag is canonicalized | UTS #35 Part 1 § 3.2.1, `<territoryAlias>` (BU→MM and others); ECMA-402 § 6.2.3 CanonicalizeUnicodeLocaleId; `Intl.Locale` constructor canonicalizes |
| Disputed regions are refused on every host | **GMT rule.** README rule 7; GMT owns no CLDR data |

CLDR 44–48 (`sd-release-*.xml`, same in all four): CN first mon; JO first sat, weekend fri–sat;
DZ first sat, weekend fri–sat; BD first sun, no weekend entry (→ sat–sun).

## The difference (measured)

| Tag | CLDR | macOS 27 WebKit (system ICU) | Linux WebKit 26.6, Chromium 153, Firefox 155, Node 22/24/26 |
| --- | --- | --- | --- |
| `zh-CN`, `zh`, `en-CN` | 1 / [6,7] | 7 / [6,7] | CLDR |
| `ar-JO` | 6 / [5,6] | 7 / [5,6] | CLDR |
| `ar-DZ`, `fr-DZ` | 6 / [5,6] | 1 / [6,7] | CLDR |
| `bn-BD` | 7 / [6,7] | 7 / [5,6] | CLDR |
| `und-BU` (and JT, MI, NT, PU, PZ, RH, WK, YD) | the successor's data | `001` data; `.region` is `"BU"` while `toString()` is `"und-MM"` | CLDR |

So the disputed values are: **first day** for regions CN, JO, DZ; **weekend** for DZ and BD.

## Step 0 — re-measure before coding

The table above came from a handful of tags. Sweep every region before fixing the set:

- Every CLDR territory code (from `sd-release-48.xml` `<territoryContainment>` leaves, plus the
  `<territoryAlias>` deprecated codes) as `und-XX`, and every tag in GMT's locale test matrix.
- Hosts: Node 22, 24, 26 (`fnm exec --using=<v>`), local Chromium, Firefox and macOS WebKit
  (Playwright from `apps/dox`, temp file, deleted after), Linux WebKit/Chromium/Firefox through
  Docker `mcr.microsoft.com/playwright:v1.63.0-noble` (scratchpad `lx/w.mjs` is the template).
- Also measure on every host: `und-CN-u-fw-mon`, `zh-CN-u-fw-sun`, `en-US-u-rg-cnzzzz`,
  `en-US-u-rg-dzzzzz`, and what `new Intl.Locale(t).maximize().region` returns for the
  language-only tags in the matrix.

Every region whose `firstDay` or `weekend` differs on any host joins the refused set under the same
rule (the set is data in one module, not scattered). A host that ignores `rg` or maps a language to a
different region is a further dispute: settle it under rule 7 the same way (repair if one standard
answer is reachable from what every host gets right, else refuse) and record it here. Report the
final set before writing tests.

## The fix

New `internal/weekDataRefusal.ts` (name may follow house style):

```ts
/** Regions whose CLDR first day some host in the weekly runs does not return. */
export const DISPUTED_FIRST_DAY_REGIONS: ReadonlySet<string>; // CN, JO, DZ (+ step 0)
/** Regions whose CLDR weekend some host in the weekly runs does not return. */
export const DISPUTED_WEEKEND_REGIONS: ReadonlySet<string>; // DZ, BD (+ step 0)
```

`localeWeekInfo(locale)` becomes the one place week data is read:

1. Resolve as today (`resolveRequiredLocale`), then build the `Intl.Locale` from the canonical
   string (`new Intl.Locale(new Intl.Locale(resolved).toString())`), so a deprecated region reads
   its successor's data on every host. Repair: canonicalization is right on every host; only the
   `.region` getter is wrong on macOS WebKit.
2. The week region: the `rg` region if the tag has a valid `-u-rg-` (if step 0 shows every host
   honours it; otherwise per step 0's decision), else `maximize().region`, else `001`.
3. `firstDay`: if the tag has `-u-fw-<day>`, GMT maps the keyword itself (`mon`→1 … `sun`→7) on
   every host — a caller override, standard-defined, no host data. Otherwise, if the week region is
   in `DISPUTED_FIRST_DAY_REGIONS`, the first day is **refused**. Otherwise the host's value.
4. `weekend`: refused if the week region is in `DISPUTED_WEEKEND_REGIONS`; else the host's value.

"Refused" means each reader returns its existing sentinel (`getLocaleFirstDayOfWeek` → `null`,
`getLocaleWeekendDays` → `null`, so every public function returns its own sentinel). A function that
needs only the weekend still works for a region whose first day is refused, and the other way round
(`isWeekend("…", "zh-CN")` is a value; `getLocaleStartOfWeek("…", "zh-CN")` is the sentinel;
`getLocaleStartOfWeek("…", "zh-CN-u-fw-mon")` is a value). Check every reader in the index's list
(plain/calculate, plain/compare, plain/locale `getLocaleWeekdayNames`, zoned/*) reads through
`localeWeekInfo` and needs no change beyond the sentinel it already returns.

`minimalDays` needs nothing: it is already a caller value with the ISO default
(`resolveMinimalDaysInFirstWeek`).

## Compat entry D36

- `repros.ts`: group `D36`, canary-only (unconditional, rule 2 exception): for each disputed
  region, a repro whose expected value is CLDR's (above, with the CLDR release cited), reading the
  host's `getWeekInfo`/`weekInfo` for `und-<region>`; plus `und-BU` region canonicalization.
  `CanaryDefectId` gains `"D36"`.
- README: rule 2's unconditional list gains D36; a Workarounds row; a Removal-trigger row ("every
  engine in the weekly runs returns CLDR's week data for the D36 regions"); a removal step 36 (a
  minor changeset: refused values become values).
- `scripts/lib/workarounds.mjs` entry; `WHAT_BREAKS.D36` in `apps/dox/src/data/temporal-compat.ts`:
  "The first day of the week in China, Jordan and Algeria, and the weekend in Algeria and
  Bangladesh, which Safari on macOS 27 reports differently from the other runtimes and from CLDR.
  GMT returns its empty value for these on every runtime unless the locale names a first day with
  `-u-fw-`" (adjust to step 0's final set).
- Canary script tests that list groups (`apps/dox/scripts/canary/*.test.ts`) gain D36 where they
  list D33–D35.

## Tests

- `getLocaleFirstDayOfWeek.test.ts`, `getLocaleWeekendDays` tests, and one public row per reader:
  sentinel rows for each disputed region and tag form (`zh-CN`, `zh`, `en-CN`, `ar-JO`, `ar-DZ`,
  `bn-BD`); value rows for the same tags with `-u-fw-`; value rows for undisputed regions;
  `und-BU` reads MM's data. Every row passes unchanged on Node 22/24/26, Chromium, Firefox and WebKit.
- Tests that compare GMT with `src/test/runtimeWeekInfo.ts` skip disputed regions by reading the
  same exported sets (never a copied list), and assert the sentinel for them instead.
- The README Workarounds-table test and any compat-group listing test stay green.
