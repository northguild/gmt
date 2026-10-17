## N. The Dox items of the international-standards audit (continued)

### N2. The example rebalance (step N2)

- **Scope:** `apps/dox/src/content` (outside the generated `docs/reference/`), the
  `CHAT_STARTERS`, the `dox-tools.ts` schema examples, and the widget presets and defaults in
  `src/lib`. At re-verification `America/New_York` led the content examples many times over
  `Europe/London` and `Asia/Tokyo`, and appeared in most widget modules; re-count before starting
  (the I13 gate is the measure).
- **The rule:** rotate examples through `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`,
  `America/Sao_Paulo`, `Africa/Johannesburg` and `Asia/Kolkata`. Keep a zone where the example
  needs its DST shape (pick the rotated zone with the same shape: a northern spring gap is
  `Europe/London`, a southern one `Australia/Sydney`; a zone without DST is `Asia/Tokyo` or
  `Asia/Kolkata`) or where a standard's own code names it (an X12 time code). `America/New_York`
  may remain as one peer among the six-plus, never the lead and never the majority. Locales are
  regionless where a locale is needed (`"en"`), unless the example is about a region's format.
  No US holiday (`07-04`) leads a calendar example.
- **Re-verify every output by running it** against the built `dist`. A changed example's result is
  pasted from the run, never edited by hand. Test fixtures under `packages/gmt` and the CI zone
  matrix are untouched; a Dox test that asserts a changed preset's output is updated from the run,
  and each such change is listed in the builder's report.
- **Permalinks** in content are rebuilt with `encodeWidgetPermalink` when their seed changes.
- **Starters:** each area's cards rotate zones; `chat-starters.test.ts`'s concrete-place pattern
  (`/Tokyo|New York|London|\d/`) widens to the six rotated cities, so no card needs New York to
  pass.
- **The split** is in section K (builders F–J).
