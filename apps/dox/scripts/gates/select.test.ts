import { describe, expect, it } from "vitest";
import { importsOf, sitePathOf } from "./graph.mjs";
import {
  CAP,
  CAP_REST,
  isRelevant,
  pickEvenly,
  selectPages,
} from "./select.mjs";

const SAMPLE = ["/", "/why-gmt/", "/tools/dwell-ledger/"];

/** A page that reaches `closure` files and the library modules in `gmt`. */
function page(sitePath: string, closure: string[] = [], gmt: string[] = []) {
  return {
    path: sitePath,
    file: `apps/dox/src/content/docs${sitePath}index.mdx`,
    closure,
    gmt,
  };
}

const WIDGET = "apps/dox/src/lib/tools/dwell-ledger/widget.ts";
const HELPER = "apps/dox/src/lib/format.ts";

const pages = [
  page("/", [HELPER]),
  page("/why-gmt/", [HELPER]),
  page("/tools/dwell-ledger/", [WIDGET, HELPER], ["plain/calculate"]),
  page(
    "/tools/dst-inspector/",
    ["apps/dox/src/lib/tools/dst/widget.ts"],
    ["zoned/get"],
  ),
  page("/guides/other/", []),
];

const select = (changed: string[], extra = {}) =>
  selectPages({ changed, pages, sample: SAMPLE, ...extra });

describe("selectPages", () => {
  it("selects the tool page a widget file belongs to", () => {
    const plan = select([WIDGET]);
    expect(plan.pages).toEqual(["/tools/dwell-ledger/"]);
    expect(plan.reasons["/tools/dwell-ledger/"]).toEqual([WIDGET]);
  });

  it("selects every page that reaches a shared src/lib helper", () => {
    expect(select([HELPER]).pages).toEqual([
      "/",
      "/tools/dwell-ledger/",
      "/why-gmt/",
    ]);
  });

  it("selects the sample for a customCss file", () => {
    const plan = select(["apps/dox/src/styles/tokens.css"]);
    expect(plan.pages).toEqual([...SAMPLE].sort());
    expect(plan.reasons["/"][0]).toMatch(/^chrome:/);
  });

  it("selects the sample for a component override, astro.config.mjs and package.json", () => {
    for (const file of [
      "apps/dox/src/components/Header.astro",
      "apps/dox/astro.config.mjs",
      "apps/dox/package.json",
    ]) {
      expect(select([file]).pages).toEqual([...SAMPLE].sort());
    }
  });

  it("selects the sample for pnpm-lock.yaml", () => {
    const plan = select(["pnpm-lock.yaml"]);
    expect(plan.pages).toEqual([...SAMPLE].sort());
    expect(plan.reasons["/"]).toEqual(["chrome: pnpm-lock.yaml"]);
  });

  it("selects the pages importing a changed library module", () => {
    const plan = select(["packages/gmt/src/plain/calculate/addDays.ts"]);
    expect(plan.pages).toEqual(["/tools/dwell-ledger/"]);
    expect(plan.reasons["/tools/dwell-ledger/"]).toEqual([
      "imports @northguild/gmt/plain/calculate",
    ]);
  });

  it("selects the sample for a library change no page imports", () => {
    expect(select(["packages/gmt/src/regex/index.ts"]).pages).toEqual(
      [...SAMPLE].sort(),
    );
    expect(select(["packages/gmt/src/plain/nothing/x.ts"]).pages).toEqual(
      [...SAMPLE].sort(),
    );
  });

  it("runs a changed gate script on the sample and names the gate", () => {
    const plan = select(["apps/dox/scripts/readout-still.mjs"], {
      gateScripts: { "readout-still.mjs": "readout-still" },
    });
    expect(plan.pages).toEqual([]);
    expect(plan.gatesOnSample).toEqual(["readout-still"]);
  });

  it("runs the axe gate on the sample when its exclusion list changes", () => {
    const plan = select(["apps/dox/scripts/a11y-axe-exclusions.json"], {
      gateScripts: { "a11y-axe-exclusions.json": "a11y-axe" },
    });
    expect(plan.pages).toEqual([]);
    expect(plan.gatesOnSample).toEqual(["a11y-axe"]);
  });

  it("ignores a json file in scripts/ that no gate reads", () => {
    const plan = select(["apps/dox/scripts/other.json"], {
      gateScripts: { "a11y-axe-exclusions.json": "a11y-axe" },
    });
    expect(plan.gatesOnSample).toEqual([]);
  });

  it("runs every gate on the sample when the runner itself changes", () => {
    expect(select(["apps/dox/scripts/gates/select.mjs"]).gatesOnSample).toEqual(
      ["*"],
    );
  });

  it("selects nothing for a test file, a doc, or a file no page reaches", () => {
    const plan = select([
      "apps/dox/src/lib/format.test.ts",
      "context/dox/built.md",
      "apps/dox/src/lib/unused.ts",
    ]);
    expect(plan.pages).toEqual([]);
    expect(plan.relevant).toBe(true);
    expect(select(["context/dox/built.md"]).relevant).toBe(false);
  });

  it("caps at the sample plus six evenly picked pages", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      page(`/p/${String(i).padStart(2, "0")}/`, [HELPER]),
    );
    const universe = [...pages.slice(0, 3), ...many];
    const plan = selectPages({
      changed: [HELPER],
      pages: universe,
      sample: SAMPLE,
    });
    expect(plan.capped).toEqual({ from: 33, to: SAMPLE.length + CAP_REST });
    expect(plan.pages).toHaveLength(SAMPLE.length + CAP_REST);
    expect(plan.pages).toEqual(expect.arrayContaining(SAMPLE));
    expect(plan.pages.length).toBeLessThanOrEqual(CAP);
  });

  it("leaves 12 pages or fewer alone", () => {
    const dozen = Array.from({ length: CAP }, (_, i) =>
      page(`/q/${i}/`, [HELPER]),
    );
    const plan = selectPages({
      changed: [HELPER],
      pages: dozen,
      sample: SAMPLE,
    });
    expect(plan.capped).toBeNull();
    expect(plan.pages).toHaveLength(CAP);
  });

  it("lifts the cap with --all and selects every page", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      page(`/p/${i}/`, [HELPER]),
    );
    const plan = selectPages({
      changed: [],
      pages: many,
      sample: SAMPLE,
      all: true,
    });
    expect(plan.pages).toHaveLength(30);
    expect(plan.capped).toBeNull();
  });
});

describe("pickEvenly", () => {
  it("returns a short list whole and a long one spread across it", () => {
    expect(pickEvenly(["a", "b"], 6)).toEqual(["a", "b"]);
    const picked = pickEvenly(
      Array.from({ length: 24 }, (_, i) => i),
      6,
    );
    expect(picked).toEqual([2, 6, 10, 14, 18, 22]);
  });
});

describe("isRelevant", () => {
  it("counts the site, the library source and the lockfile, never a test", () => {
    expect(isRelevant("apps/dox/src/lib/a.ts")).toBe(true);
    expect(isRelevant("packages/gmt/src/plain/x.ts")).toBe(true);
    expect(isRelevant("pnpm-lock.yaml")).toBe(true);
    expect(isRelevant("apps/dox/src/lib/a.test.ts")).toBe(false);
    expect(isRelevant("README.md")).toBe(false);
  });
});

describe("graph helpers", () => {
  it("maps page files to site paths", () => {
    expect(sitePathOf("apps/dox/src/content/docs/index.mdx")).toBe("/");
    expect(sitePathOf("apps/dox/src/content/docs/tools/dwell-ledger.mdx")).toBe(
      "/tools/dwell-ledger/",
    );
    expect(sitePathOf("apps/dox/src/content/docs/guides/a/index.mdx")).toBe(
      "/guides/a/",
    );
    expect(sitePathOf("apps/dox/src/content/docs/guides/concepts/b.md")).toBe(
      "/guides/concepts/b/",
    );
    expect(sitePathOf("apps/dox/src/pages/dox.astro")).toBe("/dox/");
    expect(sitePathOf("apps/dox/src/pages/[...slug].astro")).toBeNull();
    expect(sitePathOf("apps/dox/src/lib/a.ts")).toBeNull();
  });

  it("reads static, dynamic and css imports", () => {
    const source = `
      import A from "~/components/A.astro";
      import { b } from "../lib/b";
      const c = await import("./c.ts");
      export { d } from "@northguild/gmt/plain/calculate";
      @import "./x.css";
    `;
    expect(importsOf(source).sort()).toEqual(
      [
        "./c.ts",
        "./x.css",
        "../lib/b",
        "@northguild/gmt/plain/calculate",
        "~/components/A.astro",
      ].sort(),
    );
  });
});
