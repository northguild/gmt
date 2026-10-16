# MAR-16 — GNSS time scales, the leap-second table and TAI: implementation spec

Story: [`issues/MAR-16.md`](../../issues/MAR-16.md) (tracker #197). This story also builds **all of
[SPA-48](../../issues/SPA-48.md)** (#229, which flips to Done with it) and **`toTAI` / `fromTAI`
from [SPA-46](../../issues/SPA-46.md)** (#227, which keeps only the TAI64 labels). GMT supports the
**world-standard set of six satellite time scales** as peers: GPS, Galileo, BeiDou, QZSS, GLONASS
and NavIC, by their RINEX 4.02 §5.2.8 identifiers. No system is a default and none has functions of
its own (D6; tracker, "International authority first"). Owner decisions on scope, the six systems as
peers, the leap-second table, GLONASS, NavIC and the namespace layout are final; this spec does not
re-open them.

**Where the code lives (owner decision, D13).** Two new namespaces:

- **`timescale/`** — a Core namespace like `precision/`: the leap-second table and its queries, and
  `toTAI` / `fromTAI`.
- **`gnss/`** — a cross-industry layer for the GNSS industry, which Maritime draws on now and
  Aviation and IoT later: the six satellite system times, the week and rollover functions, and
  the RINEX week functions.

There is no `space/` and no `maritime/` namespace in this story. Story IDs (MAR-16, SPA-48, SPA-46)
do not change; only code locations do.

**Sources.** Clause wording and editions come from
[`research/mar-16-gnss-icd-clauses.md`](../../research/mar-16-gnss-icd-clauses.md) (2026-10-15; "R§n"
is its section n). Its §12 rows are folded into §0 and its §11 corrections into §8.1, including
§5a (NavIC) and correction 13.

**Verification.** Every expected value below was produced by running code, not from memory:

- `@js-temporal/polyfill` 0.5.1 on Node 24.21.0, through a scratch reference implementation of
  the algorithms in §3;
- the leap-second table parsed from IERS `Leap_Second.dat`, fetched 2026-10-15 (header "Updated
  through IERS Bulletin 72 issued in July 2026"; SHA-256
  `6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7`), each row's MJD checked
  against its date by code; the researcher's parse (R§6.1) gives the same 28 rows;
- IERS Bulletin C 72 and ITU-R TF.460-6, fetched and quoted verbatim (R§6.2, R§7.1 agree);
- rollover instants that match the researcher's own runs (R§8, R§5a.7).

A round-trip sweep (every TAI-based system and TAI, ±2 s, ±1 s, ±1 ns and the inserted second
around each of the 27 leap seconds) ran 563 conversions with 0 failures. tdd-dev re-verifies each
row in its red step.

---
