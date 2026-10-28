import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureLabels,
  legOf,
  listOpenGateIssues,
  main,
  parseArgs,
  readJobs,
  runActions,
} from "./file-issues.mjs";
import {
  DOWNLOAD_STEP,
  NOT_UPLOADED_KEY,
  SUMMARY_STEP,
  UPLOAD_STEP,
  marker,
} from "./issue-plan.mjs";

type Call = { args: string[]; input?: string };
/** A `gh` that records calls and answers from `reply`. */
function fakeGh(reply: (args: string[], input?: string) => string = () => "") {
  const calls: Call[] = [];
  return {
    calls,
    gh: (args: string[], input?: string) => {
      calls.push({ args, input });
      return reply(args, input);
    },
  };
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
/** Writes `artifacts/<leg>/summary.json` and returns its path. */
function summaryFile(leg: string, summary: unknown) {
  const root = mkdtempSync(join(tmpdir(), "file-issues-"));
  dirs.push(root);
  mkdirSync(join(root, leg));
  const file = join(root, leg, "summary.json");
  writeFileSync(
    file,
    typeof summary === "string" ? summary : JSON.stringify(summary),
  );
  return file;
}

const failing = {
  status: "FAIL",
  rows: [
    {
      id: "a11y-axe",
      status: "FAIL",
      detail: "1 page",
      findings: [
        {
          kind: "finding",
          gate: "a11y-axe",
          rule: "color-contrast",
          page: "/x/",
          selector: "#a",
          browser: "chromium",
          width: 390,
          theme: "dark",
          message: "m",
        },
      ],
    },
  ],
};
const env: Record<string, string> = {
  GITHUB_ACTIONS: "true",
  GITHUB_SERVER_URL: "https://github.test",
  GITHUB_REPOSITORY: "o/r",
  GITHUB_RUN_ID: "7",
  GITHUB_SHA: "deadbee",
};

describe("parseArgs", () => {
  it("takes files, --print, --dry-run-finding and --legs", () => {
    expect(
      parseArgs([
        "--print",
        "--dry-run-finding",
        "--legs",
        "a,b",
        "x/summary.json",
      ]),
    ).toEqual({
      ok: true,
      files: ["x/summary.json"],
      print: true,
      dryRun: true,
      legs: ["a", "b"],
    });
  });
  it("rejects no input and unknown flags", () => {
    expect(parseArgs([]).ok).toBe(false);
    expect(parseArgs(["--nope", "f"]).ok).toBe(false);
    expect(parseArgs(["--legs"]).ok).toBe(false);
  });
});

describe("the gh argument lists", () => {
  it("creates only the missing labels, with their descriptions and colours", () => {
    const { gh, calls } = fakeGh(() => JSON.stringify([{ name: "bug" }]));
    ensureLabels(gh, ["bug", "dox-gate"]);
    expect(calls.map((c) => c.args)).toEqual([
      ["label", "list", "--json", "name", "--limit", "1000"],
      [
        "label",
        "create",
        "dox-gate",
        "--description",
        "Opened by the nightly Dox gate sweep",
        "--color",
        "b60205",
      ],
    ]);
  });

  it("lists open issues by the dox-gate label", () => {
    const { gh, calls } = fakeGh(() => "[]");
    listOpenGateIssues(gh);
    expect(calls[0].args).toEqual([
      "issue",
      "list",
      "--label",
      "dox-gate",
      "--state",
      "open",
      "--limit",
      "1000",
      "--json",
      "number,body,labels",
    ]);
  });

  it("opens with the Bug type and the labels, and comments with the body on stdin", () => {
    const { gh, calls } = fakeGh();
    const results = runActions(gh, [
      {
        kind: "open",
        key: "k",
        title: "T",
        labels: ["bug", "dox-gate"],
        body: "B",
      },
      { kind: "comment", key: "k", issue: 12, body: "C" },
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(calls).toEqual([
      {
        args: [
          "issue",
          "create",
          "--title",
          "T",
          "--type",
          "Bug",
          "--label",
          "bug",
          "--label",
          "dox-gate",
          "--body-file",
          "-",
        ],
        input: "B",
      },
      { args: ["issue", "comment", "12", "--body-file", "-"], input: "C" },
    ]);
  });

  it("records a failed call and runs the next action", () => {
    let n = 0;
    const { gh } = fakeGh(() => {
      if (n++ === 0) throw new Error("HTTP 502");
      return "";
    });
    const results = runActions(gh, [
      { kind: "comment", key: "a", issue: 1, body: "x" },
      { kind: "comment", key: "b", issue: 2, body: "y" },
    ]);
    expect(results.map((r) => r.ok)).toEqual([false, true]);
  });
});

/** One line of the jobs listing `readJobs` asks `gh api` for. */
const jobLine = (name: string, conclusion: string, steps: [string, string][]) =>
  JSON.stringify({
    name,
    conclusion,
    steps: steps.map(([n, c]) => ({ name: n, conclusion: c })),
  });

describe("readJobs", () => {
  it("asks for every job of the run and keys the sweep jobs by leg", () => {
    const { gh, calls } = fakeGh(() =>
      [
        jobLine("Changed since the last run?", "success", []),
        jobLine("Sweep (chromium-1)", "failure", [[SUMMARY_STEP, "success"]]),
        "not json",
        "",
        jobLine("Sweep (webkit-2)", "cancelled", []),
        jobLine("Report to issues", "success", []),
      ].join("\n"),
    );
    const jobs = readJobs(gh, "o/r", "7");
    expect(calls[0].args.slice(0, 3)).toEqual([
      "api",
      "--paginate",
      "repos/o/r/actions/runs/7/jobs?per_page=100",
    ]);
    expect([...jobs.keys()]).toEqual(["chromium-1", "webkit-2"]);
    expect(jobs.get("chromium-1")).toEqual({
      conclusion: "failure",
      steps: [{ name: SUMMARY_STEP, conclusion: "success" }],
    });
    expect(jobs.get("webkit-2")).toEqual({
      conclusion: "cancelled",
      steps: [],
    });
  });
});

describe("the nightly workflow", () => {
  const yml = readFileSync(
    new URL(
      "../../../../.github/workflows/dox-gates-nightly.yml",
      import.meta.url,
    ),
    "utf8",
  );
  it("names the jobs and steps the report reads", () => {
    expect(yml).toContain("name: Sweep (${{ matrix.leg }})");
    for (const step of [SUMMARY_STEP, UPLOAD_STEP, DOWNLOAD_STEP])
      expect(yml).toContain(`- name: ${step}\n`);
  });

  // Without `if: always()` both steps are skipped whenever the gates fail, which is every night
  // with findings: the check could never pass, and a lost upload would read as could-not-run.
  it("runs the summary check and the upload after the gates fail", () => {
    for (const step of [SUMMARY_STEP, UPLOAD_STEP])
      expect(yml).toMatch(
        new RegExp(`- name: ${step}\\n\\s+if: always\\(\\)\\n`),
      );
  });
});

describe("main", () => {
  const io = (gh: ReturnType<typeof fakeGh>["gh"]) => {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      io: {
        env,
        gh,
        stdout: (t: string) => out.push(t),
        stderr: (t: string) => err.push(t),
      },
    };
  };

  it("--print plans against the live list and runs no write", () => {
    const { gh, calls } = fakeGh(() => "[]");
    const { out, io: i } = io(gh);
    const file = summaryFile("chromium-1", failing);
    expect(main(["--print", "--dry-run-finding", file], i)).toBe(0);
    expect(calls.map((c) => c.args[0] + " " + c.args[1])).toEqual([
      "issue list",
    ]);
    expect(out.join("")).toContain("open  a11y-axe:color-contrast:/x/:#a");
    expect(out.join("")).toContain("open  dry-run:synthetic:/:body  [dry run]");
    expect(out.join("")).toContain("2 actions planned (not run)");
  });

  it("files the findings: labels, then the issue, exit 0", () => {
    const { gh, calls } = fakeGh((args) => (args[0] === "label" ? "[]" : "[]"));
    const { io: i } = io(gh);
    expect(main([summaryFile("chromium-1", failing)], i)).toBe(0);
    const verbs = calls.map((c) => c.args.slice(0, 2).join(" "));
    expect(verbs).toEqual([
      "issue list",
      "label list",
      "label create",
      "label create",
      "issue create",
    ]);
    expect(calls.at(-1)!.input!.split("\n")[0]).toBe(
      marker("a11y-axe:color-contrast:/x/:#a"),
    );
  });

  it("makes no write call when nothing failed", () => {
    const { gh, calls } = fakeGh(() => "[]");
    const { out, io: i } = io(gh);
    expect(
      main([summaryFile("chromium-1", { status: "PASS", rows: [] })], i),
    ).toBe(0);
    expect(calls).toHaveLength(1);
    expect(out.join("")).toContain("0 actions");
  });

  it("files a leg named in --legs that has no summary as could-not-run", () => {
    const { gh } = fakeGh(() => "[]");
    const { out, io: i } = io(gh);
    expect(
      main(
        [
          "--print",
          "--legs",
          "chromium-1,webkit-2",
          summaryFile("chromium-1", { status: "PASS", rows: [] }),
        ],
        i,
      ),
    ).toBe(0);
    expect(out.join("")).toContain("dox-gate:could-not-run:webkit-2");
    expect(out.join("")).not.toContain("could-not-run:chromium-1");
  });

  it("files a leg that wrote a summary the report never got as not-uploaded", () => {
    const { gh, calls } = fakeGh((args) =>
      args[0] === "api"
        ? jobLine("Sweep (webkit-2)", "failure", [
            ["Gates, every page (shard 2/3)", "failure"],
            [SUMMARY_STEP, "success"],
          ])
        : "[]",
    );
    const { out, err, io: i } = io(gh);
    expect(
      main(
        [
          "--print",
          "--legs",
          "chromium-1,webkit-2",
          summaryFile("chromium-1", { status: "PASS", rows: [] }),
        ],
        i,
      ),
    ).toBe(0);
    expect(calls.map((c) => c.args[0])).toEqual(["api", "issue"]);
    expect(out.join("")).toContain(`open  ${NOT_UPLOADED_KEY}`);
    expect(out.join("")).not.toContain("could-not-run");
    expect(err).toHaveLength(0);
  });

  it("still files could-not-run when the job list cannot be read, and says so", () => {
    const { gh } = fakeGh((args) => {
      if (args[0] === "api") throw new Error("HTTP 403");
      return "[]";
    });
    const { out, err, io: i } = io(gh);
    expect(main(["--print", "--legs", "webkit-2"], i)).toBe(0);
    expect(out.join("")).toContain("open  dox-gate:could-not-run:webkit-2");
    expect(err.join("")).toContain("cannot read the run's jobs: HTTP 403");
  });

  it("reads no job list outside a run", () => {
    const { gh, calls } = fakeGh(() => "[]");
    const out: string[] = [];
    main(["--print", "--legs", "webkit-2"], {
      env: { GITHUB_ACTIONS: "" },
      gh,
      stdout: (t: string) => out.push(t),
      stderr: () => {},
    });
    expect(calls.map((c) => c.args[0])).toEqual(["issue"]);
    expect(out.join("")).toContain("open  dox-gate:could-not-run:webkit-2");
  });

  it("treats an unreadable summary of a named leg as could-not-run", () => {
    const { gh } = fakeGh(() => "[]");
    const { out, io: i } = io(gh);
    main(
      ["--print", "--legs", "firefox-1", summaryFile("firefox-1", "not json")],
      i,
    );
    expect(out.join("")).toContain("dox-gate:could-not-run:firefox-1");
  });

  it("exits 2 with zero gh calls for a mistyped path without --legs", () => {
    const { gh, calls } = fakeGh(() => "[]");
    const { err, io: i } = io(gh);
    expect(main(["/nonexistent.json"], i)).toBe(2);
    expect(main(["--print", "/nonexistent.json"], i)).toBe(2);
    expect(main(["--print", "artifacts/x/missing.json"], i)).toBe(2);
    expect(calls).toHaveLength(0);
    expect(err.join("")).toContain("cannot");
  });

  it("files could-not-run for the one leg that is missing", () => {
    const { gh } = fakeGh(() => "[]");
    const { out, io: i } = io(gh);
    const ok = summaryFile("chromium-1", { status: "PASS", rows: [] });
    expect(
      main(
        [
          "--print",
          "--legs",
          "chromium-1,chromium-2",
          ok,
          "/gone/chromium-2/summary.json",
        ],
        i,
      ),
    ).toBe(0);
    expect(out.join("")).toContain("open  dox-gate:could-not-run:chromium-2");
    expect(out.join("")).not.toContain("could-not-run:chromium-1");
  });

  it("files one per leg when every leg is missing, with the glob unexpanded or empty", () => {
    for (const files of [["artifacts/*/summary.json"], []]) {
      const { gh } = fakeGh(() => "[]");
      const { out, err, io: i } = io(gh);
      expect(main(["--print", "--legs", "a-1,b-2,c-3", ...files], i)).toBe(0);
      const text = out.join("");
      for (const leg of ["a-1", "b-2", "c-3"])
        expect(text).toContain(`open  dox-gate:could-not-run:${leg}`);
      expect(text).toContain("3 actions planned");
      expect(err).toHaveLength(0);
    }
  });

  it("never plans a key that ends in a colon from a leg-less path", () => {
    const { gh } = fakeGh(() => "[]");
    const { out, io: i } = io(gh);
    main(["--print", "--legs", "a-1", "/nonexistent.json"], i);
    expect(main(["--print", "/nonexistent.json"], i)).toBe(2);
    for (const line of out.join("").split("\n")) {
      const key = /^open {2}(\S+)/.exec(line)?.[1];
      if (key) expect(key.endsWith(":")).toBe(false);
    }
  });

  it("only plans outside GitHub Actions: no --print exits 2 with zero gh calls", () => {
    const { gh, calls } = fakeGh(() => "[]");
    const out: string[] = [];
    const err: string[] = [];
    const local = {
      env: { ...env, GITHUB_ACTIONS: "" },
      gh,
      stdout: (t: string) => out.push(t),
      stderr: (t: string) => err.push(t),
    };
    expect(main([summaryFile("chromium-1", failing)], local)).toBe(2);
    expect(calls).toHaveLength(0);
    expect(err.join("")).toContain(
      "run with --print locally; issues are filed by the nightly workflow",
    );
    expect(main(["--print", summaryFile("chromium-1", failing)], local)).toBe(
      0,
    );
  });

  it("exits 1 when a gh call fails, 2 on usage", () => {
    const { gh } = fakeGh(() => {
      throw new Error("HTTP 403");
    });
    const { err, io: i } = io(gh);
    expect(main([summaryFile("chromium-1", failing)], i)).toBe(1);
    expect(err.join("")).toContain("HTTP 403");
    expect(main([], i)).toBe(2);
  });
});

describe("legOf", () => {
  it("is the folder name, without the artifact prefix", () => {
    expect(legOf("artifacts/chromium-3/summary.json")).toBe("chromium-3");
    expect(legOf("artifacts/dox-gates-webkit-1/summary.json")).toBe("webkit-1");
  });
});
