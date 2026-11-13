# Slice 5 — guidance-text: how disruptive a change would be, from evidence

Index: [index.md](index.md). Facts: [evidence-data.md](evidence-data.md), by row number (E1–E18).
Use the plain-english skill on every string. Static text uses dated wording; nothing here runs
code except the one runtime line noted.

## Kit pieces

- **`keyPoints`** from `widgets/families/clockcheck/key-points.ts`, with the `KeyCard` and
  `KeyPart` shapes from `src/data/clock-change-text.ts`. Its cards already have a full 1 px
  border, bevel corners and forced-colours rules. **No left-border accent.** If a card needs an
  accent, it takes a bottom border (`border-block-end`) in its module.
- **Kit addition.** `keyPoints(idPrefix, cards, heading = KEY_POINTS_HEADING)` gets an optional
  third argument. The checkers pass none, so their markup does not change (html-diff).
- Links are `{ link, href }` parts through `withBase`. Function names are `{ fn, href }` chips
  linked to the reference pages.

## `apps/dox/src/data/sunshine-protection-act-guidance.ts` (new)

`export const US_GUIDANCE: readonly KeyCard[]` holds five cards, in this order. The heading on
the page is **"If the clocks stop changing"**. Each card body is two to four short paragraphs or
one ordered list. The drafts below are the content. Builders may tighten the wording, but not
change the claims.

### 1. "Devices learn about a change from a tz release" (id `sunshine-notice`)

- "Phones, servers and browsers read their clock rules from the IANA tz database. A change
  reaches a device only after a new release ships and the device installs it." (E1)
- "The tz maintainers ask for a year's notice. In 2022 Mexico ended most daylight time two days
  after the law was published, and its border areas changed a month later." (E3)
- "The national proposal starts on the day it becomes law, with no later start date. Software
  could have days, not months, to catch up." (`NATIONAL.effects[1]`, E16)
- Link: the Canada and Morocco checker pages ("what a runtime with old tz data gets wrong").

### 2. "Saved future times can shift" (id `sunshine-saved`)

- "A meeting saved as a local wall time keeps its wall time. A meeting saved as an instant keeps
  its instant, so it shows one hour later or earlier once the rules change."
- Link: Stored Time Audit (`/tools/stored-time-audit/`), with the function chips it uses.
- No offsets are projected. The card says which kind of saved time moves, never by how much in
  which zone. That is phase 2's job, from a tz release.

### 3. "Neighbours follow, or do not" (id `sunshine-neighbours`)

- "Mexico's border areas keep the same clock changes as their US neighbours. A US change would
  leave them changing alone unless they follow." (E3)
- "Three states tie their switch to their neighbours: one waits for three neighbours, one for one
  neighbour, and one for federal law." (rows DE, ID and TX; place names come from the data rows,
  not this file)
- "A state already on standard time all year the day before could keep its time. Arizona's
  offset from its neighbours would then stay the same all year." (E16; `NATIONAL.effects[2]`)

### 4. "What sleep and safety research says" (id `sunshine-health`)

The order follows the international-first rule:

1. "The Society for Research on Biological Rhythms, an international body, prefers standard time
   all year to either switching or daylight time all year." (E7)
2. "In 2018 the European Commission asked the public: of 4.6 million replies, 84% wanted the
   changes to end. The EU has not agreed which time to keep." (E8)
3. "European sleep research societies favour standard time." (E9, **cut if not verified**)
4. "In the United States, the national sleep medicine academy calls for standard time all year."
   (E10, labelled as a national peer)
5. "Fatal crashes rose 6% in the week after the spring change in a study of 732,835 crashes, more
   in the morning and in the west of each zone." (E11)

Name each body. A scientific society is a source, not a lawmaking body, so the "names no body"
rule does not bar it. Never name a legislature or a bill.

### 5. "It has been tried before" (id `sunshine-history`)

- "The United States kept daylight time all year from January 1974. It went back to standard
  time that October, ten months later." (E6, E12)
- "The United Kingdom kept summer time all year from 1968 to 1971, then went back." (E4)
- "Russia moved to permanent summer time in 2011 and to permanent winter time in 2014." (E5)
- "How strong is the evidence? The short-term harm after each change is well measured. Whether
  a permanent setting helps or harms over years is mixed." (E12, E13, E18)

## Federal panel copy (Proposals view)

The panel shows the `NATIONAL.effects` list under the heading **"The national proposal"**,
followed by:

- the runtime age line from `ageWords` ([evidence-data.md](evidence-data.md));
- one **"Sources"** link to `SOURCES_URL`.

## Wording rules this slice must pass

- Never use: "Congress", "Senate", "House", "Act", "bill", "statute", "section", "exempt",
  "compliant" or "legal". Write "federal law", "national proposal" or "state law" instead, and
  only where needed.
- No US-first framing in the international card. The US peer is item 4, not item 1.
- "Daylight time" and "standard time", not "summer" and "winter", except where quoting the UK and
  Russia history.
- A test in slice 8 scans `US_GUIDANCE` and `NATIONAL` against the word list.
