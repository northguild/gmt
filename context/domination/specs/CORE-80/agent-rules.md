# Slice 11 — Cost rules for the agents

Read with [index.md](./index.md). Story scope part 8. Text only, no source change. Source text:
[the audit's Part 3](../../../perf-and-bundle-size-audit/agent-changes-and-decisions.md#part-3--recommended-agent-and-rule-changes),
adjusted to the code as slices 1–10 leave it. Write the rules once, in
`context/coding-standards.md`, and link to them from the agent files rather than copying them,
as the reviewer file already says it does for the checklist.

## A. `context/coding-standards.md` § Loop Style — add **Loop cost**

After the sentinel paragraph, a `### Loop cost` subsection (its anchor is what the other files
link to). Content:

- **Name what bounds every loop.** Bounded by a constant, or by the output size, needs no
  more. A count that grows with the input span, a log's length or a holiday list's length needs a
  stated reason no closed form exists, in a comment beside the loop.
- **Formula first.** Before stepping day by day: epoch-day arithmetic (`epochDayOf`,
  `isoFieldsOf`, `isoWeekdayOf` in `internal/epochDay.ts`), whole-week jumps, and binary search
  over sorted arrays (`lowerBound`, `countWithin`). Walk only the remainder, at most a week, and
  only the dates near a zone transition.
- **Temporal at the edges.** Parse inputs once on the way in; format once on the way out. No
  Temporal object built or parsed per loop step or inside a sort comparator.
- **Resolve once.** A calendar, schedule, zone or rule set is validated and resolved once per
  public call and passed in resolved form to an `internal/` core. A public function never calls
  another public function; both call the core.
- **Remember only what is pure.** A module-level memo holds only facts that are a pure function
  of their key for the life of the process (zone transitions, parsed holiday strings, validated
  zone ids, `Intl` formatters built from explicit arguments). It is bounded and cleared on
  overflow, stores no answer that depends on the clock or on process defaults, and does no work
  at import time. The existing memos are in `internal/zonedTransitionSearch.ts`,
  `internal/businessCalendar.ts`, `internal/offsetTimeline.ts` and `internal/formatterCache.ts`;
  reuse them before adding one.
- **No `new Intl.*Format` outside `internal/formatterCache.ts`** (and the default-locale read in
  `internal/resolveLocale.ts`).
- **Nothing runs at import, and no fixtures ship.** No top-level Temporal or `Intl` call. Test
  data, repros and canary tables never live in a module shipped code imports.
- **Measure what you add.** A function with a span-dependent loop gets a `packages/gmt/bench/`
  row for a short, a 1-year and a 10-year input. The handoff gives the numbers and the size
  delta of each touched entry from `pnpm size --files <entry>`. No timing assertion in an `it`
  row: it is flaky across the CI matrix.
- **The existing rows are the contract when optimising.** A rewrite keeps every row green on the
  full zone matrix. Old against new over random inputs is a check, never an expected value.

## B. `.agents/tdd-dev.md` — **Performance shape**

A `## Performance shape` section after `## Implementation shape`, three lines:

- Follow [§ Loop cost](../context/coding-standards.md#loop-cost) for every loop you write.
- In the handoff, name what bounds each loop, and give the bench rows and the `pnpm size
  --files` delta it asks for.
- An optimisation that changes any output is a defect, not a trade-off.

Add one line to the `## Handoff checklist`: loop bounds named; bench and size figures included
where a loop grows with the input.

## C. `.agents/gmt-reviewer.md` — the **Cost** step

Insert after step 9 (invariants), renumbering 10–12 to 11–13; update any in-file reference to
those numbers (`rg -n 'step 1[0-2]' .agents/gmt-reviewer.md` before and after).

> 10. **Check the cost.** Apply [§ Loop cost](../context/coding-standards.md#loop-cost) to each
>     loop in the diff: find what bounds it. Flag a count that grows with span, log or holiday
>     count where a closed form or binary search exists; a nested loop over the same input; a
>     Temporal parse or construction per iteration or in a comparator; a public function called
>     from another; an `Intl` constructor outside the formatter cache; module-level work or
>     shipped test data; a new static import that pulls a large internal module into a small
>     entry. Run `pnpm size` and report the delta of every entry the diff touches. The finding's
>     oracle is the measurement: input sizes and times, before and after.

In `## Output`, add **cost** to the "what was checked and found clean" list, and add to the
`Blocking or not` bullet: "A Cost finding blocks in new or changed code. One in code the diff
did not touch is reported, not blocking." (Owner decision 3.)

## D. `context/code-review-checklist.md` § Architecture

Append three items:

```markdown
- [ ] No loop's count grows with the input span where a closed form exists; no Temporal parse or construction per iteration or in a comparator ([§ Loop cost](./coding-standards.md#loop-cost))
- [ ] Calendars, schedules and zones resolved once per call; no public function calls another; no `new Intl.*Format` outside the formatter cache
- [ ] No module-level work and no test data in shipped modules; `pnpm size` within budget
```

## E. `.agents/architect.md` — state the target complexity

In `## Output`, after the sentence listing what a plan includes, add: "A spec with a loop over a
span, a log or a list states the target complexity and the bench rows that show it, per
[§ Loop cost](../context/coding-standards.md#loop-cost)."

## F. `context/coding-standards.md` § Changesets — one row

Insert after the "Bug fix" row:
`| Speed or bundle-size change with no change to output, option or signature | \`patch\` |`.
The changeset states the savings: before → after for size (minified and gzipped) and speed.

## G. Where the text lands in other copies

`.claude/agents/*.md` are symlinks to `.agents/`; nothing to copy. Check whether the Dox
contributor page or `context/skills.md` paraphrases the reviewer's step list (`rg -n
'invariants' context apps/dox/src --glob '*.md*'`); if one does, add the Cost step there in the
same words.

## Tests

None: text only. Checks:

| Check | Expected |
| ----- | -------- |
| Every new link `#loop-cost` | resolves to the new heading: `validate` has no markdown link check, so open each from its file |
| `rg -n 'businessCalendar.ts' context/coding-standards.md .agents/tdd-dev.md` | no stale pointer to where `epochDayOf` used to live |
| `.agents/gmt-reviewer.md` step numbers | 1–13, consecutive; no reference to an old number left |

## Done when

- The five files carry the text above; the rules live in one place and the agent files link to
  it.
- `pnpm run validate` green.
