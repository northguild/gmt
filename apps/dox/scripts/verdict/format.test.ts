import {
  formatDuration,
  formatScreen,
} from "../../../../scripts/lib/verdict-format.mjs";

/**
 * Slice 2 of #396: the screen. Slices 3 and 7 print through the same function, so these tests pin
 * it line for line.
 */

const PASS_ROWS = [
  { status: "PASS", index: 1, label: "deps check", duration: "0.4s" },
  { status: "PASS", index: 2, label: "build", duration: "2m10s" },
  {
    status: "PASS",
    index: 10,
    label: "temporal-compat snapshot --check",
    duration: "11.8s",
  },
];

describe("formatScreen", () => {
  it("prints a failed run line for line", () => {
    const rows = [
      ...PASS_ROWS,
      {
        status: "FAIL",
        index: 11,
        label: "test",
        duration: "3m02s",
        details: [
          "dox  scripts/gates/select.test.ts > select > maps a widget file to its page",
          "  AssertionError: expected [] to deeply equal [ '/tools/dst-inspector/' ]",
          "  ❯ scripts/gates/select.test.ts:41:18",
          "1 more in .verdict/validate/11-test.log",
        ],
      },
      {
        status: "----",
        index: 12,
        label: "bundle-size check",
        detail: "not run",
      },
    ];
    expect(
      formatScreen({
        title: "verdict validate",
        status: "FAIL at step 11 of 12 (pnpm -r --if-present run test)  9m41s",
        rows,
        logPath: "/abs/path/.verdict/validate/11-test.log",
      }).split("\n"),
    ).toEqual([
      "verdict validate: FAIL at step 11 of 12 (pnpm -r --if-present run test)  9m41s",
      "  PASS   1  deps check                         0.4s",
      "  PASS   2  build                             2m10s",
      "  PASS  10  temporal-compat snapshot --check  11.8s",
      "  FAIL  11  test                              3m02s",
      "            dox  scripts/gates/select.test.ts > select > maps a widget file to its page",
      "              AssertionError: expected [] to deeply equal [ '/tools/dst-inspector/' ]",
      "              ❯ scripts/gates/select.test.ts:41:18",
      "            1 more in .verdict/validate/11-test.log",
      "  ----  12  bundle-size check  not run",
      "log: /abs/path/.verdict/validate/11-test.log",
    ]);
  });

  it("prints a pass with a detail column and the log folder", () => {
    const rows = [
      {
        status: "PASS",
        index: 1,
        label: "lint",
        detail: "",
        duration: "11.8s",
      },
      {
        status: "PASS",
        index: 2,
        label: "test",
        detail: "36,412 tests",
        duration: "3m02s",
      },
    ];
    expect(
      formatScreen({
        title: "verdict validate",
        status: "PASS  2 of 2  3m14s",
        rows,
        logPath: "/abs/path/.verdict/validate",
      }),
    ).toBe(
      [
        "verdict validate: PASS  2 of 2  3m14s",
        "  PASS   1  lint                11.8s",
        "  PASS   2  test  36,412 tests  3m02s",
        "log: /abs/path/.verdict/validate",
      ].join("\n"),
    );
  });

  it("leaves a row without an index blank where the index goes", () => {
    const text = formatScreen({
      title: "verdict gates",
      status: "FAIL",
      rows: [
        { status: "PASS", label: "a11y", duration: "1.0s" },
        { status: "FAIL", label: "contrast", duration: "2.0s" },
      ],
    });
    expect(text.split("\n")).toEqual([
      "verdict gates: FAIL",
      "  PASS      a11y      1.0s",
      "  FAIL      contrast  2.0s",
    ]);
  });

  it("omits the log line when there is no log, and keeps no trailing spaces", () => {
    const text = formatScreen({
      title: "t",
      status: "PASS",
      rows: [{ status: "PASS", label: "x" }],
    });
    expect(text.split("\n")).toEqual(["t: PASS", "  PASS      x"]);
  });
});

describe("formatDuration", () => {
  it.each([
    [400, "0.4s"],
    [11_800, "11.8s"],
    [59_940, "59.9s"],
    [60_000, "1m00s"],
    [130_000, "2m10s"],
    [182_000, "3m02s"],
    [581_000, "9m41s"],
  ])("%d ms -> %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
