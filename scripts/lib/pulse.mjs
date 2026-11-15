/**
 * The list of checks GMT runs on a schedule, and the one place that says what each one watches,
 * what a finding does and what retires it. The Dox page `/pulse/`, the table in
 * `context/canary/overview.md` and the drift check (`pnpm pulse:check`) all read this list.
 *
 * Plain data, Node built-ins only, no side effect on import. Cadence, job names, run history and
 * counts are never typed here: `apps/dox/scripts/build-pulse.mjs` reads them from the workflow
 * files and from GitHub.
 *
 *   id        unique, kebab-case; the source file names it on a `# Pulse check: <id>` line
 *   name      the card or row title
 *   area      "temporal" | "clocks" | "site"
 *   source    the workflow file, or the unscheduled canary's test file, from the repo root
 *   job       the workflow job this check is part of, when the workflow has several
 *   scripts   `scripts/canary/*.mjs` detectors this check runs
 *   watches   what is compared, in plain words
 *   finds     what a finding does
 *   life      what retires the check (a condition, never a date):
 *               { kind: "permanent", why }
 *               { kind: "workarounds", groups: "all" | [group id] }  (a group id is its defects joined with " + ")
 *               { kind: "condition", until, waitsOn?: [filing key], waitsOnRepos?: [repo] }
 *   story     the story that built it, for the overview table
 */

export const PULSE_AREAS = Object.freeze([
  {
    id: "temporal",
    heading: "Watching Temporal",
    blurb: "The engines and the polyfill GMT runs on.",
  },
  {
    id: "clocks",
    heading: "Watching the world's clocks",
    blurb: "The tables and rules that time zones and leap seconds come from.",
  },
  {
    id: "site",
    heading: "Watching this site",
    blurb: "The pages themselves.",
  },
]);

export const PULSE_CHECKS = Object.freeze([
  {
    id: "workaround-node",
    name: "Workaround check (Node)",
    area: "temporal",
    source: ".github/workflows/temporal-oracle.yml",
    job: "oracle",
    watches:
      "Each workaround's probes on Node: is the polyfill defect still there?",
    finds:
      "Opens one issue for each workaround that every engine in its scope no longer needs.",
    life: { kind: "workarounds", groups: "all" },
    story: "CORE-81",
  },
  {
    id: "native-oracle",
    name: "Native oracle",
    area: "temporal",
    source: ".github/workflows/temporal-oracle.yml",
    job: "oracle",
    watches:
      "GMT's calendar results against Chromium's built-in Temporal. The test262 suite decides a disagreement.",
    finds: "Opens one issue for the mismatches no workaround accounts for.",
    life: {
      kind: "condition",
      until:
        "every engine ships Temporal and the polyfill is removed from GMT (#316)",
    },
    story: "CORE-81",
  },
  {
    id: "native-suite",
    name: "Native suite",
    area: "temporal",
    source: ".github/workflows/temporal-oracle.yml",
    job: "native-suite",
    watches:
      "The whole library test suite on built-in Temporal and on the polyfill, in Node, Chromium, Firefox and WebKit. Each browser also runs the workaround probes.",
    finds:
      "Opens one issue per engine for a difference no workaround accounts for, one for a host that failed and one for a stale tag.",
    life: {
      kind: "condition",
      until:
        "every engine ships Temporal and the polyfill is removed from GMT (#316)",
    },
    story: "CORE-82",
  },
  {
    id: "polyfill-swap",
    name: "Polyfill swap",
    area: "temporal",
    source: ".github/workflows/temporal-oracle.yml",
    job: "polyfill-swap",
    watches:
      "The suite on the newest `temporal-polyfill`, beside `@js-temporal/polyfill`. The Node run also sweeps every zone's offsets and every calendar's years against Node.",
    finds: "Opens one issue when every run passes: the swap is due.",
    life: {
      kind: "condition",
      until:
        "the fixes GMT waits on have shipped in `temporal-polyfill` and GMT has moved to it",
      waitsOn: [],
      waitsOnRepos: ["fullcalendar/temporal-polyfill"],
    },
    story: "CORE-92",
  },
  {
    id: "cldr-sweep",
    name: "CLDR locale sweep",
    area: "temporal",
    source: ".github/workflows/cldr-sweep-weekly.yml",
    job: "sweep",
    scripts: ["scripts/canary/weekYear.mjs", "scripts/canary/rangeFields.mjs"],
    watches:
      "Every locale and calendar in `cldr-dates-full`: week-of-year years, V8 aborts, and range text that drops, repeats or garbles a field of one date.",
    finds:
      "Fails the run when a detector misses. The job summary lists the locales that newly break and the ones fixed since the last run.",
    life: { kind: "workarounds", groups: ["D23", "D24", "D29"] },
    story: "CORE-112",
  },
  {
    id: "leap-seconds",
    name: "Leap-second table",
    area: "clocks",
    source: ".github/workflows/leap-seconds.yml",
    job: "canary",
    watches:
      "GMT's leap-second table against the IERS `Leap_Second.dat` file, or IANA's `leap-seconds.list` when IERS is down.",
    finds: "Opens one issue per difference.",
    life: {
      kind: "condition",
      until:
        "the table is closed for good: IERS publishes the file format for continuous UTC",
    },
    story: "CORE-81",
  },
  {
    id: "us-clock-watch",
    name: "US clock-change watch",
    area: "clocks",
    source: ".github/workflows/us-clock-watch.yml",
    job: "canary",
    watches:
      "Federal and state bills on ending the clock changes, and the time zone rules of every US zone, against the committed snapshot.",
    finds:
      "Opens one issue per kind (federal, state, tz) for a difference, and one for a source that could not run.",
    life: {
      kind: "condition",
      until:
        "the US clock-change checker ships, and the proposals data on the Sunshine Protection Act page is removed",
    },
    story: "CORE-90",
  },
  {
    id: "runtime-tz",
    name: "Runtime time zone data",
    area: "clocks",
    source: "apps/dox/src/lib/runtime-tz-canary.test.ts",
    watches:
      "That the test machine's time zone database gives the offsets the Canada and Morocco pages state.",
    finds: 'Fails the Dox tests with "Update Node."',
    life: {
      kind: "condition",
      until:
        "the oldest Node GMT supports ships the time zone data those pages state",
    },
    story: "Dox epic",
  },
  {
    id: "dox-gates",
    name: "Dox weekly gate sweep",
    area: "site",
    source: ".github/workflows/dox-gates-weekly.yml",
    job: "sweep",
    watches:
      "Every Dox page's gates in Chromium, Firefox and WebKit, in both themes.",
    finds: "Opens or updates `dox-gate` issues.",
    life: {
      kind: "permanent",
      why: "A page can break without a change to it, so the sweep stays while the site does.",
    },
    story: "Dox epic",
  },
  {
    id: "deploy-dox",
    name: "Daily rebuild",
    area: "site",
    source: ".github/workflows/deploy-dox.yml",
    job: "deploy",
    watches:
      "Rebuilds and deploys the site, so the upstream filing states on `/upstream/` are read again.",
    finds: "Fails the run when the build or the deploy fails.",
    life: {
      kind: "permanent",
      why: "The filing states change without a commit, so the page has to be rebuilt to show them.",
    },
    story: "Dox epic",
  },
]);
