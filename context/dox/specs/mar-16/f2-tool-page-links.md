## F. Content pages (continued)

### F2. The tool pages and links

- **Five tool pages**, in the shape of `tools/epcis-event-reader.mdx`: frontmatter with title,
  description and the tag of section D; `ToolLayout` with a use case; a key point; an intro; the
  widget `fullbleed`; an `after` slot with **The rule**, what is drawing and what is the
  library's, **When there is no result**, a code block of `call // result` lines pasted from the
  run, **Worth trying** with three or four permalinks, and **Reference** linking every function
  the tool calls and its guide. Use cases: "Satellite week numbers and rollovers"; "One instant
  on every satellite clock"; "Week-rollover exposure of a receiver"; "Leap seconds since 1972";
  "Elapsed seconds across leap seconds". Each page links the other tools D13 links it to.
  `GLO` is described in section 0's words and no others.
- **Links into the tools** (step D4), one each, in the page's related-links list or beside the
  passage it illustrates, each a seeded permalink with the page's own numbers:
  `gnss-week-that-wrapped.mdx` and `thirteen-bit-week-read-as-ten-bit.mdx` (decoder and rollover
  checker), `rinex-week-read-as-broadcast.mdx` (decoder), `gnss-offset-hardcoded.mdx` (clock
  converter), `a-leap-second-that-never-happened.mdx` (timeline), the three guides (their tools),
  `mistakes/gnss.mdx` and `mistakes/leap-seconds.mdx` (beside the matching pairs).
- `guides/core-date-operations/nanosecond-precision.mdx` line 102: "Leap-second-aware time scales
  (TAI, GPS) are not part of this namespace." becomes "Leap-second-aware time scales (TAI and the
  satellite clocks) are not part of this namespace." and gains links to the two guides (each by its
  real title).
- `guides/core-date-operations/spans.mdx` "Leap seconds are not counted" bullet (line 80) gains
  "To count them, compare TAI readings: see [Elapsed vs. Clock
  Difference](/tools/elapsed-vs-clock-difference/)."
- `tools/index.mdx` and the hubs are generated.
