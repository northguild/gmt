/**
 * What `Date` gets wrong, as the home page states it.
 *
 * Here rather than in `WhyDateBug.astro` so the text surfaces can render the same table: a
 * component's frontmatter is not importable, and passing the tag through shipped a raw
 * `<WhyDateBug />` into `.md`, `llms-full.txt` and the retrieval chunks (CORE-8 review, #253).
 *
 * The `input` strings name `Date` on purpose — that is the argument — so this file is exempt in
 * `date-ban.test.ts`, as `WhyDateBug.astro` was.
 */
export interface Fault {
  input: string;
  output: string;
  why: string;
}

export const dateFaults: Fault[] = [
  {
    input: 'new Date("2025-01-15")',
    output: "Tue Jan 14 2025 19:00 GMT−5",
    why: "A bare date string is UTC midnight. West of Greenwich that is still the previous evening. Add a time and the rule silently flips to local.",
  },
  {
    input: 'new Date("2025-03-30T01:30")',
    output: "02:30 — no error",
    why: "01:30 never happened in London that night — the clocks jumped 01:00 → 02:00. Date invents a nearby valid instant instead of telling you.",
  },
  {
    input: "new Date(2025, 3, 1)",
    output: "April 1, not March 1",
    why: "Months are 0-indexed. Days are 1-indexed. In the same constructor call.",
  },
  {
    input: "d.setDate(d.getDate() + 1)",
    output: "mutates d in place",
    why: "A Date handed to a function can be changed underneath you. There is no read-only Date.",
  },
  {
    input: '"09:00 every Tuesday, Tokyo"',
    output: "not representable",
    why: "A Date is a single integer — milliseconds since the epoch. It cannot hold a wall-clock time or a recurring local time.",
  },
  {
    input: "same code, two machines",
    output: "two different answers",
    why: "Parsing and formatting use the host timezone. A laptop in Denver and a CI runner in UTC disagree.",
  },
  {
    input: "wrapper.now() / wrapper(dateString)",
    output: "a native Date, renamed",
    why: "Most Date-wrapping libraries store a real Date as their internal state and default their clock to it. Every fault above is still reachable — only the syntax changed.",
  },
  {
    input: "DST edge-case coverage",
    output: "thin, disabled, or failing",
    why: "DST transitions are the hardest case for a Date-shaped model to get right. It shows: wrapper libraries' own test suites are consistently the ones most likely to under-test, skip, or fail exactly this case.",
  },
  {
    input: "how a wrapper checks itself",
    output: "against a sibling wrapper, not a spec",
    why: "With no independent standard to test against, a Date-wrapping library can only grade itself against another one — so a bug shared by the whole family passes every one of their suites.",
  },
];
