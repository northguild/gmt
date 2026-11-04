import {
  BODY_BUDGET,
  BODY_LIMIT,
  DOWNLOAD_STEP,
  DRY_RUN_KEY,
  FLOOD_KEY,
  NOT_UPLOADED_KEY,
  SUMMARY_STEP,
  TABLE_ROWS,
  UPLOAD_STEP,
  collect,
  fit,
  flakyRows,
  keyOf,
  marker,
  matches,
  planIssueActions,
} from "./issue-plan.mjs";

const TARGET = 'widget:foo › slider "Week #"';

/** The shapes the runner's `summary.json` holds, reduced to what the planner reads. */
const finding = (over: Record<string, unknown> = {}) => ({
  kind: "finding",
  gate: "a11y-axe",
  rule: "color-contrast",
  page: "/tools/foo/",
  target: TARGET,
  selector: "#a > b",
  browser: "chromium",
  width: 390,
  theme: "dark",
  message: "Elements must have sufficient color contrast",
  ...over,
});
const failRow = (findings: unknown[], id = "a11y-axe") => ({
  id,
  status: "FAIL",
  detail: "2 pages",
  findings,
  logTail: ["last line"],
});
const leg = (name: string, rows: unknown[]) => ({
  leg: name,
  summary: { status: "FAIL", rows } as any,
});
/** A sweep job as the run's job list gives it: its end, then each step's. */
const job = (conclusion: string | null, steps: [string, string | null][]) => ({
  conclusion,
  steps: steps.map(([name, c]) => ({ name, conclusion: c })),
});
const GATES = "Gates, every page (shard 1/6)";
/** The job of a leg whose runner finished and wrote summary.json. */
const ranJob = job("failure", [
  ["Install chromium", "success"],
  [GATES, "failure"],
  [SUMMARY_STEP, "success"],
  [UPLOAD_STEP, "success"],
]);
const context = { runUrl: "https://example.test/run/1", sha: "abc1234" };
const issue = (number: number, body: string, labels = ["dox-gate"]) => ({
  number,
  body,
  labels: labels.map((name) => ({ name })),
});

describe("planIssueActions", () => {
  it("opens an issue when no open issue carries the marker", () => {
    const actions = planIssueActions(
      [leg("chromium-1", [failRow([finding()])])],
      [],
      context,
    );
    expect(actions).toHaveLength(1);
    const [a] = actions as any[];
    expect(a.kind).toBe("open");
    expect(a.title).toBe("Dox gate: color-contrast on /tools/foo/ (a11y-axe)");
    expect(a.labels).toEqual(["dox-gate"]);
    expect(a.labels).not.toContain("bug");
    expect(a.body.split("\n")[0]).toBe(
      marker(`a11y-axe:color-contrast:/tools/foo/:${TARGET}`),
    );
    expect(a.body).toContain(
      "pnpm --filter dox gates --only a11y-axe --pages /tools/foo/ --browsers chromium",
    );
    expect(a.body).toContain("https://example.test/run/1");
    expect(a.body).toContain("abc1234");
  });

  it("comments on the lowest-numbered open issue that matches", () => {
    const key = `a11y-axe:color-contrast:/tools/foo/:${TARGET}`;
    const open = [
      issue(40, `${marker(key)}\nbody`),
      issue(12, `${marker(key)}\nbody`),
    ];
    const [a] = planIssueActions(
      [leg("chromium-1", [failRow([finding()])])],
      open,
      context,
    ) as any[];
    expect(a).toMatchObject({ kind: "comment", issue: 12, key });
    expect(a.body).toContain(
      "Still failing at abc1234: https://example.test/run/1",
    );
  });

  it("does not match a marker on line 2, or an issue without the dox-gate label", () => {
    const key = `a11y-axe:color-contrast:/tools/foo/:${TARGET}`;
    expect(matches(issue(1, `intro\n${marker(key)}`), key)).toBe(false);
    expect(matches(issue(1, marker(key), ["bug"]), key)).toBe(false);
    expect(matches(issue(1, `${marker(key)}\nx`), key)).toBe(true);
    const [a] = planIssueActions(
      [leg("chromium-1", [failRow([finding()])])],
      [issue(1, `intro\n${marker(key)}`)],
      context,
    );
    expect(a.kind).toBe("open");
  });

  it("does not file a FLAKY gate, and lists it", () => {
    const legs = [
      leg("webkit-1", [
        { id: "readout-still", status: "FLAKY", detail: "failed once" },
      ]),
    ];
    expect(planIssueActions(legs, [], context)).toEqual([]);
    expect(flakyRows(legs)).toEqual([
      { leg: "webkit-1", gate: "readout-still", detail: "failed once" },
    ]);
  });

  it("files one issue for a key seen in two browsers, themes and widths", () => {
    const actions = planIssueActions(
      [
        leg("chromium-1", [
          failRow([finding(), finding({ width: 1440, theme: "light" })]),
        ]),
        leg("webkit-1", [failRow([finding({ browser: "webkit" })])]),
      ],
      [],
      context,
    ) as any[];
    expect(actions).toHaveLength(1);
    expect(actions[0].body).toContain("| chromium-1 | chromium | 390 | dark |");
    expect(actions[0].body).toContain(
      "| chromium-1 | chromium | 1440 | light |",
    );
    expect(actions[0].body).toContain("| webkit-1 | webkit | 390 | dark |");
  });

  it("keys on the target and ignores the selector", () => {
    expect(keyOf(finding({ selector: "  #a   >\n b " }) as any)).toBe(
      `a11y-axe:color-contrast:/tools/foo/:${TARGET}`,
    );
    const entries = collect([
      leg("chromium-1", [
        failRow([
          finding({ selector: "#a  > b" }),
          finding({ selector: "div:nth-of-type(3) > b" }),
        ]),
      ]),
    ]);
    expect(entries).toHaveLength(1);
    expect(
      collect([
        leg("chromium-1", [
          failRow([
            finding(),
            finding({ target: 'widget:foo › slider "End"' }),
          ]),
        ]),
      ]),
    ).toHaveLength(2);
  });

  it("escapes quotes and dashes of a selector in the marker so line 1 stays one comment", () => {
    const line = marker('a:r:/:widget:x › button "Go"[2] > b -- c');
    expect(line.startsWith('<!-- dox-gate key="')).toBe(true);
    expect(line.endsWith('" -->')).toBe(true);
    expect(line.slice(4, -3)).not.toContain("-->");
    expect(line.slice(4, -3)).not.toContain("--");
  });

  it("files a leg with no summary as could-not-run", () => {
    const [a] = planIssueActions(
      [{ leg: "firefox-2", summary: null }],
      [],
      context,
    ) as any[];
    expect(a.title).toBe("Dox weekly could not run the firefox-2 leg");
    expect(a.body.split("\n")[0]).toBe(
      marker("dox-gate:could-not-run:firefox-2"),
    );
    expect(a.labels).toEqual(["dox-gate"]);
    expect(a.body).toContain("did not say how the leg ended");
    expect(a.body).toContain("lost its upload");
  });

  it("files every leg that wrote a summary the report never got as one not-uploaded issue", () => {
    const actions = planIssueActions(
      [
        { leg: "chromium-1", summary: null, job: ranJob },
        { leg: "webkit-2", summary: null, job: ranJob },
      ],
      [],
      context,
    ) as any[];
    expect(actions).toHaveLength(1);
    const [a] = actions;
    expect(a.kind).toBe("open");
    expect(a.title).toBe("Dox weekly: leg findings did not reach the report");
    expect(a.body.split("\n")[0]).toBe(marker(NOT_UPLOADED_KEY));
    expect(a.body).toContain(`\`${UPLOAD_STEP}\``);
    expect(a.body).toContain(`\`${DOWNLOAD_STEP}\``);
    expect(a.body).toContain("| chromium-1 | chromium |");
    expect(a.body).toContain("| webkit-2 | webkit |");
    expect(a.body).not.toContain("Reproduce");
    expect(a.body).not.toContain("could not run");
  });

  it("does not flood when all twelve legs lost their upload", () => {
    const legs = ["chromium", "webkit", "firefox"].flatMap((b) =>
      [1, 2, 3, 4].map((i) => ({
        leg: `${b}-${i}`,
        summary: null,
        job: ranJob,
      })),
    );
    const actions = planIssueActions(legs, [], context) as any[];
    expect(actions.map((a) => a.key)).toEqual([NOT_UPLOADED_KEY]);
  });

  it("files a leg whose runner wrote no summary as could-not-run, naming the first step that did not succeed", () => {
    const crashed = job("failure", [
      ["Install chromium", "success"],
      [GATES, "failure"],
      [SUMMARY_STEP, "failure"],
      [UPLOAD_STEP, "success"],
      ["Post Run actions/checkout@v7", "skipped"],
    ]);
    const [a] = planIssueActions(
      [{ leg: "chromium-1", summary: null, job: crashed }],
      [],
      context,
    ) as any[];
    expect(a.body.split("\n")[0]).toBe(
      marker("dox-gate:could-not-run:chromium-1"),
    );
    expect(a.title).toBe("Dox weekly could not run the chromium-1 leg");
    expect(a.body).toContain("wrote no summary.json");
    expect(a.body).toContain("Its job ended `failure`");
    expect(a.body).toContain(`\`${GATES}\` (\`failure\`)`);
    expect(a.body).not.toContain("lost its upload");
  });

  it("names a cancelled gates step and an install that failed before the gates", () => {
    const cancelled = job("cancelled", [
      [GATES, "cancelled"],
      [SUMMARY_STEP, "failure"],
    ]);
    const install = job("failure", [
      ["Install webkit", "failure"],
      [GATES, "skipped"],
      [SUMMARY_STEP, "failure"],
    ]);
    const actions = planIssueActions(
      [
        { leg: "firefox-1", summary: null, job: cancelled },
        { leg: "webkit-1", summary: null, job: install },
      ],
      [],
      context,
    ) as any[];
    const body = (leg: string) =>
      actions.find((a) => a.key === `dox-gate:could-not-run:${leg}`).body;
    expect(body("firefox-1")).toContain(
      `Its job ended \`cancelled\`; the first step that did not succeed is \`${GATES}\` (\`cancelled\`)`,
    );
    expect(body("webkit-1")).toContain(
      "the first step that did not succeed is `Install webkit` (`failure`)",
    );
  });

  it("files a job that never started a step as could-not-run", () => {
    const [a] = planIssueActions(
      [{ leg: "webkit-3", summary: null, job: job("cancelled", []) }],
      [],
      context,
    ) as any[];
    expect(a.key).toBe("dox-gate:could-not-run:webkit-3");
    expect(a.body).toContain("Its job ended `cancelled`.");
  });

  it("ignores the job of a leg that has a summary", () => {
    const crashed = job("cancelled", [[SUMMARY_STEP, "failure"]]);
    expect(
      planIssueActions(
        [{ ...leg("chromium-1", []), job: crashed }],
        [],
        context,
      ),
    ).toEqual([]);
  });

  it("files a FAIL with no structured findings as unstructured, quoting the log tail", () => {
    const row = {
      id: "readout-still",
      status: "FAIL",
      detail: "timed out after 90m",
      findings: [],
      logTail: ["boom", "at x"],
    };
    const [a] = planIssueActions(
      [leg("chromium-2", [row])],
      [],
      context,
    ) as any[];
    expect(a.body.split("\n")[0]).toBe(
      marker("readout-still:unstructured:all:"),
    );
    expect(a.body).toContain("timed out after 90m");
    expect(a.body).toContain("boom\nat x");
    expect(a.body).toContain(
      "pnpm --filter dox gates --only readout-still --browsers chromium",
    );
  });

  it("opens ten new issues and floods at eleven", () => {
    const many = (n: number) =>
      leg("chromium-1", [
        failRow(
          Array.from({ length: n }, (_, i) => finding({ page: `/p${i}/` })),
        ),
      ]);
    expect(
      planIssueActions([many(10)], [], context).every((a) => a.kind === "open"),
    ).toBe(true);
    expect(planIssueActions([many(10)], [], context)).toHaveLength(10);

    const flood = planIssueActions([many(11)], [], context) as any[];
    expect(flood).toHaveLength(1);
    expect(flood[0].kind).toBe("open");
    expect(flood[0].body.split("\n")[0]).toBe(marker(FLOOD_KEY));
    expect(flood[0].body).toContain("a11y-axe:color-contrast:/p10/");
    expect(flood[0].body).toContain("/p0/");
  });

  it("comments on the existing flood issue and still comments on matched findings", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      finding({ page: `/p${i}/` }),
    );
    const known = `a11y-axe:color-contrast:/p0/:${TARGET}`;
    const actions = planIssueActions(
      [leg("chromium-1", [failRow(rows)])],
      [issue(3, marker(FLOOD_KEY)), issue(4, marker(known))],
      context,
    ) as any[];
    expect(actions.map((a) => [a.kind, a.issue])).toEqual(
      expect.arrayContaining([
        ["comment", 3],
        ["comment", 4],
      ]),
    );
    expect(actions.filter((a) => a.kind === "open")).toHaveLength(0);
  });

  it("adds one synthetic dry-run finding under its own label", () => {
    const [a] = planIssueActions([], [], { ...context, dryRun: true }) as any[];
    expect(a.kind).toBe("open");
    expect(a.title.startsWith("[dry run] ")).toBe(true);
    expect(a.labels).toEqual(["dox-gate-dry-run", "dox-gate"]);
    expect(a.labels).not.toContain("bug");
    expect(a.body.split("\n")[0]).toBe(marker(DRY_RUN_KEY));
  });

  it("comments on the dry-run issue the second time", () => {
    const [a] = planIssueActions([], [issue(9, marker(DRY_RUN_KEY))], {
      ...context,
      dryRun: true,
    }) as any[];
    expect(a).toMatchObject({ kind: "comment", issue: 9 });
  });

  it("does not count the dry-run finding towards the flood guard", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      finding({ page: `/p${i}/` }),
    );
    const actions = planIssueActions([leg("chromium-1", [failRow(rows)])], [], {
      ...context,
      dryRun: true,
    });
    expect(actions).toHaveLength(11);
    expect(actions.every((a) => a.kind === "open")).toBe(true);
  });

  describe("the flood issue", () => {
    /** 2,000 findings over 40 pages, 10 rules x 5 targets each, seen in three browsers. */
    const synthetic = () => {
      const rows: unknown[] = [];
      for (let page = 0; page < 40; page++) {
        for (let n = 0; n < 50; n++) {
          rows.push(
            finding({
              page: `/tools/p${page}/`,
              rule: `rule-${n % 10}`,
              target: `target ${page} ${n} ${"x".repeat(200)}`,
              message: "m".repeat(600),
              selector: "s".repeat(500),
            }),
          );
        }
      }
      return ["chromium", "firefox", "webkit"].map((b, i) =>
        leg(`${b}-1`, [
          failRow(
            (rows as any[]).map((r) => ({ ...r, browser: b, width: 300 + i })),
          ),
        ]),
      );
    };

    it("is one action whose body and comment stay under the limit", () => {
      const legs = synthetic();
      const ctx = { ...context, runId: "999" };
      const [a] = planIssueActions(legs, [], ctx) as any[];
      expect(planIssueActions(legs, [], ctx)).toHaveLength(1);
      expect(a.body.split("\n")[0]).toBe(marker(FLOOD_KEY));
      expect(a.body.length).toBeLessThan(BODY_LIMIT);
      const [c] = planIssueActions(
        legs,
        [issue(5, marker(FLOOD_KEY))],
        ctx,
      ) as any[];
      expect(c.kind).toBe("comment");
      expect(c.body.length).toBeLessThan(BODY_LIMIT);
    });

    it("groups by gate, rule and page with counts, browsers, widths and three targets", () => {
      const [a] = planIssueActions(synthetic(), [], context) as any[];
      expect(a.groups).toBe(400);
      const row = a.body
        .split("\n")
        .find((l: string) => l.includes("a11y-axe:rule-0:/tools/p0/"));
      expect(row).toBeDefined();
      // 5 targets, seen in three browsers and three widths.
      expect(row).toContain("| 5 |");
      expect(row).toContain("chromium, firefox, webkit");
      expect(row).toContain("300, 301, 302");
      expect(row.match(/target 0 \d+/g)).toHaveLength(3);
    });

    it("sorts rows by count, largest first, and names the run's artifacts", () => {
      const rows = [
        ...Array.from({ length: 3 }, (_, i) =>
          finding({ page: "/small/", target: `t${i}` }),
        ),
        ...Array.from({ length: 9 }, (_, i) =>
          finding({ page: "/big/", target: `t${i}` }),
        ),
      ];
      const [a] = planIssueActions(
        [leg("chromium-1", [failRow(rows)]), leg("webkit-2", [])],
        [],
        { ...context, runId: "4242" },
      ) as any[];
      expect(a.body.indexOf("/big/")).toBeLessThan(a.body.indexOf("/small/"));
      expect(a.body).toContain("dox-gate-chromium-1-4242");
      expect(a.body).toContain("dox-gate-webkit-2-4242");
      expect(a.body).toContain("14 days");
      expect(a.body).toContain(context.runUrl);
      expect(a.body).toContain(
        "Each run comments here until ten or fewer remain",
      );
      expect(a.body).not.toContain("the next run files whichever still fail");
    });

    it("shows TABLE_ROWS rows and counts the groups it left out", () => {
      const rows = Array.from({ length: 45 }, (_, i) =>
        finding({ page: `/g${i}/` }),
      );
      const [a] = planIssueActions(
        [leg("chromium-1", [failRow(rows)])],
        [],
        context,
      ) as any[];
      expect(a.groups).toBe(45);
      const shown = a.body
        .split("\n")
        .filter((l: string) => l.includes("a11y-axe:color-contrast:/g"));
      expect(shown).toHaveLength(TABLE_ROWS);
      expect(a.body).toContain("5 more groups");
    });
  });
});

describe("fit", () => {
  it("returns text within the budget as it is", () => {
    expect(fit("a\nb")).toBe("a\nb");
  });

  it("cuts a long message on a line boundary and says how many lines went", () => {
    const text = Array.from({ length: 5000 }, () => "y".repeat(99)).join("\n");
    const out = fit(text);
    expect(out.length).toBeLessThanOrEqual(BODY_BUDGET);
    const kept = out.split("\n");
    expect(kept.at(-1)).toMatch(
      /^… \d+ more lines; full list in the run's artifacts\.$/,
    );
    expect(kept.slice(0, -1).every((l) => l === "y".repeat(99))).toBe(true);
  });

  it("cuts a single 100,000-character message", () => {
    const out = fit("z".repeat(100_000));
    expect(out.length).toBeLessThanOrEqual(BODY_BUDGET);
    expect(out).toContain("more lines; full list in the run's artifacts.");
  });
});
