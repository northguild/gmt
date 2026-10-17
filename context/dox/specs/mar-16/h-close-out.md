## H. Close-out (`dox-architect`, after the tester's run)

- **`context/dox/built.md`**, present tense:
  - § Tiers 0–1, "The two industry namespaces stand apart…": rewritten as declared industries
    (B1–B9): the JSON (own namespace and `drawsOn`), cross-industry layers as industries
    (`workforce`, `gnss`), drawn-on modules (whole namespaces or sub-modules, shared industry layers
    or Core), the hubs, the Industries sidebar group, the root page, the tag rule with several tags,
    the README line, the stacked chart and its no-double-count rule. The "Page tag" bullet reads own
    namespaces.
  - § Tiers 0–1 Generator: the `expr` classification (C1); `RENAMED_FUNCTIONS` holds
    `isLeapSecond`.
  - § Tier 2: the five tools in the teaching-widget list with their rules and the GNSS family's
    shared modules and sheet; the tool-page list; their permalink keys; `readout:still`'s and
    `grow:measure`'s tool lists; the industry-tag bullet's "one entry in `industry-tags.ts`"
    sentence and its trap reworded to "own namespace"; the hours-of-work pages under Transport;
    the Converter Bench's and the DST Inspector's new defaults (N1).
  - § Tier 6: the five chat tools in the widget tools list; the tool and starter counts and the
    per-area counts re-derived from `ENABLED_TOOL_NAMES` and `CHAT_STARTERS`; the "GNSS" and
    "Leap seconds and TAI" areas; the per-visitor cap's UTC day (N1).
- `context/dox/reference/design-system.md`: § Drawn charts gains the stacked industry chart's rule
  (own segment solid, shared segments tinted and hatched, totals never double-count, legend words
  carry the meaning); and the family's five drawings join the
  list (the decoder's era lanes, the converter's lead bars, the rollover checker's window strip,
  the timeline's step chart with its continuous-UTC mark, the elapsed tool's twin rulers with
  their one-second slivers), and the sentence that names the readout gate's tools names them.
- `context/dox/tracker.md`: no row (MAR-16's realm row tracks it).
- `context/dox/built.md` and `context/domination/` CORE-76 lines: step DU writes them (M3); the
  close-out only checks them.

**Contradictions found in re-verification, to correct in the docs named:**

1. L§5.9 says the Dox playground needs nothing new. It does: C1.
2. L§5.5 and L§9.1 question 1 are answered by the owner's decision (a). L§8.4's pages are written
   by `dox-builder` (F1), with system-neutral scenario slugs, not by the library pipeline.
3. L§5.1–5.4 do not list the rename redirect; C2 adds it.
4. `built.md` § Tier 2 says "A new industry is one entry in `industry-tags.ts` and one icon": after
   B it is one entry in `industries.json`, one icon and one overview text.
5. `industry-tags.test.ts` today detects use only through a namespace-barrel import
   (`@northguild/gmt/<ns>"`), not a module-barrel import; B8 fixes it.
6. **For the library pipeline, not this work:** `spanNs`'s JSDoc (`span/calculate/spanNs.ts` line
   36) says "Leap-second-exact spans need a TAI scale, which GMT does not yet ship". After MAR-16
   it does; the sentence should name `toTAI`. Report it to the main session.
