/**
 * @vitest-environment jsdom
 *
 * The Column Timestamp Bridge end to end against the real `@northguild/gmt`.
 * Every preset's cards are literal values read once from a run of the built
 * library, and they agree with the slice's table (the † rows). A drift in the
 * library or in the widget fails here.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installJsdomShims } from "~/test/jsdom-shims";
import { BRIDGE_PRESETS } from "./column-timestamp-bridge-presets";
import {
  mountColumnTimestampBridge,
  renderColumnTimestampBridgeTemplate,
} from "./column-timestamp-bridge-mount";

installJsdomShims();

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

const clean = (el: Element | null) =>
  (el?.textContent ?? "").replace(/\u00a0/g, "").trim();

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderColumnTimestampBridgeTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountColumnTimestampBridge(
    root,
    args,
    controller.signal,
  );
  return { root, handle, controller };
}

function choose(root: HTMLElement, value: string) {
  const el = q<HTMLSelectElement>(root, "preset");
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function pick(root: HTMLElement, role: string, value: string) {
  const el = root.querySelector<HTMLInputElement>(
    `input[type="radio"][data-role="${role}"][value="${value}"]`,
  )!;
  el.checked = true;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const card = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`.gmt-colbridge-card[data-card="${id}"]`)!;
const slot = (c: HTMLElement, name: string) =>
  clean(c.querySelector(`[data-slot="${name}"]`));

// [state, stored-1, stored-2, read-back, literal]
type Row = [string, string, string, string, string];
interface Recorded {
  hero: [string, string];
  ladder: string[];
  cards: Record<string, Row>;
}

/** Read once from the built library. */
const RECORDED: Record<string, Recorded> = {
  "tokyo-seconds": {
    hero: ["instant", "2024-01-01T00:00:00Z"],
    ladder: [
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2460311",
        "nanosOfDay: 0n",
        "2024-01-01T00:00:00Z",
        "",
      ],
      arrow: ["read", "1704067200n", "", "2024-01-01T00:00:00Z", ""],
      timestamp: [
        "read",
        "seconds: 1704067200n",
        "nanos: 0",
        "2024-01-01T00:00:00Z",
        "",
      ],
      duration: [
        "read",
        "seconds: 5401n",
        "nanos: 500000000",
        "PT1H30M1.5S",
        "",
      ],
    },
  },
  "sub-microsecond": {
    hero: ["instant", "2024-01-01T00:00:00.123456789Z"],
    ladder: [
      "2024-01-01T00:00:00.123456789Z",
      "2024-01-01T00:00:00.123456789Z",
      "2024-01-01T00:00:00.123456Z",
      "2024-01-01T00:00:00.123456789Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2460311",
        "nanosOfDay: 123456789n",
        "2024-01-01T00:00:00.123456789Z",
        "",
      ],
      arrow: [
        "read",
        "1704067200123456n",
        "",
        "2024-01-01T00:00:00.123456Z",
        "",
      ],
      timestamp: [
        "read",
        "seconds: 1704067200n",
        "nanos: 123456789",
        "2024-01-01T00:00:00.123456789Z",
        "",
      ],
      duration: ["idle", "", "", "", ""],
    },
  },
  "before-1970": {
    hero: ["instant", "1969-12-31T23:59:59.9999999Z"],
    ladder: [
      "1969-12-31T23:59:59.9999999Z",
      "1969-12-31T23:59:59.9999999Z",
      "1969-12-31T23:59:59.999999Z",
      "1969-12-31T23:59:59.9999999Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2440587",
        "nanosOfDay: 86399999999900n",
        "1969-12-31T23:59:59.9999999Z",
        "",
      ],
      arrow: ["read", "-1n", "", "1969-12-31T23:59:59.999999Z", ""],
      timestamp: [
        "read",
        "seconds: -1n",
        "nanos: 999999900",
        "1969-12-31T23:59:59.9999999Z",
        "",
      ],
      duration: ["read", "seconds: -1n", "nanos: -500000000", "-PT1.5S", ""],
    },
  },
  "wall-time-zoneless": {
    hero: ["not-instant", ""],
    ladder: ["", "", "2024-01-01T00:00:00", ""],
    cards: {
      int96: ["sentinel", "", "", "", "null"],
      arrow: ["read", "1704067200000n", "", "2024-01-01T00:00:00", ""],
      timestamp: ["sentinel", "", "", "", "null"],
      duration: ["idle", "", "", "", ""],
    },
  },
  "instant-into-zoneless": {
    hero: ["instant", "2024-01-01T00:00:00Z"],
    ladder: [
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
      "",
      "2024-01-01T00:00:00Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2460311",
        "nanosOfDay: 0n",
        "2024-01-01T00:00:00Z",
        "",
      ],
      arrow: ["sentinel", "", "", "", "0n"],
      timestamp: [
        "read",
        "seconds: 1704067200n",
        "nanos: 0",
        "2024-01-01T00:00:00Z",
        "",
      ],
      duration: ["idle", "", "", "", ""],
    },
  },
  "int64-edge": {
    hero: ["instant", "2262-04-11T23:47:16.854775807Z"],
    ladder: [
      "2262-04-11T23:47:16.854775807Z",
      "2262-04-11T23:47:16.854775807Z",
      "2262-04-11T23:47:16.854775807Z",
      "2262-04-11T23:47:16.854775807Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2547339",
        "nanosOfDay: 85636854775807n",
        "2262-04-11T23:47:16.854775807Z",
        "",
      ],
      arrow: [
        "read",
        "9223372036854775807n",
        "",
        "2262-04-11T23:47:16.854775807Z",
        "",
      ],
      timestamp: [
        "read",
        "seconds: 9223372036n",
        "nanos: 854775807",
        "2262-04-11T23:47:16.854775807Z",
        "",
      ],
      duration: ["idle", "", "", "", ""],
    },
  },
  "past-proto-range": {
    hero: ["instant", "+010000-01-01T00:00:00Z"],
    ladder: ["+010000-01-01T00:00:00Z", "+010000-01-01T00:00:00Z", "", ""],
    cards: {
      int96: [
        "read",
        "julianDay: 5373485",
        "nanosOfDay: 0n",
        "+010000-01-01T00:00:00Z",
        "",
      ],
      arrow: ["sentinel", "", "", "", "0n"],
      timestamp: ["sentinel", "", "", "", "null"],
      duration: ["sentinel", "", "", "", "null"],
    },
  },
  "decode-int96-bytes": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: [
        "read",
        "bytes: 00000000000000008c3d2500",
        "",
        "1970-01-01T00:00:00Z",
        "",
      ],
      arrow: ["idle", "", "", "", ""],
      timestamp: ["idle", "", "", "", ""],
      duration: ["idle", "", "", "", ""],
    },
  },
  "decode-int96-record": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: [
        "read",
        "julianDay: 2460380",
        "nanosOfDay: 45296789000000n",
        "2024-03-10T12:34:56.789Z",
        "",
      ],
      arrow: ["idle", "", "", "", ""],
      timestamp: ["idle", "", "", "", ""],
      duration: ["idle", "", "", "", ""],
    },
  },
  "decode-int96-full-day": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: [
        "sentinel",
        "julianDay: 2440588",
        "nanosOfDay: 86400000000000n",
        "",
        '""',
      ],
      arrow: ["idle", "", "", "", ""],
      timestamp: ["idle", "", "", "", ""],
      duration: ["idle", "", "", "", ""],
    },
  },
  "decode-arrow-zoneless": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: ["idle", "", "", "", ""],
      arrow: ["read", "-1n", "", "1969-12-31T23:59:59.999999999", ""],
      timestamp: ["idle", "", "", "", ""],
      duration: ["idle", "", "", "", ""],
    },
  },
  "decode-nanos-sign": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: ["idle", "", "", "", ""],
      arrow: ["idle", "", "", "", ""],
      timestamp: ["sentinel", "seconds: 0n", "nanos: -1", "", '""'],
      duration: ["read", "seconds: 0n", "nanos: -1", "-PT0.000000001S", ""],
    },
  },
};

describe("presets against the real library", () => {
  it("records a result for every preset", () => {
    expect(Object.keys(RECORDED).sort()).toEqual(
      BRIDGE_PRESETS.map((p) => p.id).sort(),
    );
  });

  for (const p of BRIDGE_PRESETS) {
    it(`reads ${p.id}`, async () => {
      const { root, handle } = await mount({ preset: p.id });
      const want = RECORDED[p.id]!;
      const hero = q(root, "hero-exact");
      expect([hero.dataset["state"], clean(q(root, "hero-value"))]).toEqual(
        want.hero,
      );
      for (const [id, row] of Object.entries(want.cards)) {
        const c = card(root, id);
        expect(
          [
            c.dataset["state"],
            slot(c, "stored-1"),
            slot(c, "stored-2"),
            slot(c, "readback"),
            slot(c, "literal"),
          ],
          `${p.id} ${id}`,
        ).toEqual(row);
      }
      const ladder = [
        ...root.querySelectorAll('[data-role="ladder"] [data-slot]'),
      ].map(clean);
      expect(ladder).toEqual(want.ladder);
      handle.destroy();
    });
  }
});

describe("behaviour", () => {
  it("opens on the Tokyo default with no signal pill", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("tokyo-seconds");
    expect(q(root, "hero-pill").hasAttribute("data-off")).toBe(true);
  });

  it("marks a zoneless wall time as not an instant, with a chip and no hero pill", async () => {
    const { root } = await mount({ preset: "wall-time-zoneless" });
    expect(q(root, "hero-exact").dataset["state"]).toBe("not-instant");
    expect(
      card(root, "arrow")
        .querySelector('[data-slot="chip"]')!
        .hasAttribute("data-off"),
    ).toBe(false);
    // Arrow read it, so the hero does not claim a lost signal.
    expect(q(root, "hero-pill").hasAttribute("data-off")).toBe(true);
  });

  it("shows NO SIGNAL in the hero when no format read the input", async () => {
    const { root } = await mount({ value: "not a time" });
    expect(q(root, "hero-pill").hasAttribute("data-off")).toBe(false);
  });

  it("shows a legitimate zero as a value, not a lost signal", async () => {
    const { root } = await mount({ preset: "past-proto-range" });
    const arrow = card(root, "arrow");
    // A nanosecond count past int64 is out of range, not the 1970 epoch.
    expect(arrow.dataset["state"]).toBe("sentinel");
    expect(slot(arrow, "readback")).toBe("");
    expect(slot(arrow, "literal")).toBe("0n");
  });

  it("keeps a legitimate zero as a value", async () => {
    const { root } = await mount({
      value: "1970-01-01T00:00:00Z",
      unit: "second",
      zone: "UTC",
    });
    const arrow = card(root, "arrow");
    expect(arrow.dataset["state"]).toBe("read");
    expect(slot(arrow, "stored-1")).toBe("0n");
  });

  it("names an unknown zone in the other tools' words", async () => {
    const { root } = await mount({
      value: "2024-01-01T00:00:00Z",
      unit: "second",
      zone: "Mars/Olympus",
    });
    const arrow = card(root, "arrow");
    expect(arrow.dataset["state"]).toBe("sentinel");
    expect(arrow.textContent).toContain(
      "Mars/Olympus is not a time zone this browser knows.",
    );
  });

  it("fills the inputs from a preset and switches to Your values on typing", async () => {
    const { root } = await mount();
    choose(root, "sub-microsecond");
    expect(q<HTMLInputElement>(root, "value").value).toBe(
      "2024-01-01T00:00:00.123456789Z",
    );
    type(root, "value", "2024-01-01T00:00:00.5Z");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    choose(root, "custom");
    expect(q<HTMLInputElement>(root, "value").value).toBe(
      "2024-01-01T00:00:00.5Z",
    );
  });

  it("switches mode, hiding the fields the mode does not use", async () => {
    const { root } = await mount();
    expect(q(root, "decode-fields").hasAttribute("hidden")).toBe(true);
    pick(root, "mode", "decode");
    expect(q(root, "encode-fields").hasAttribute("hidden")).toBe(true);
    expect(q(root, "decode-fields").hasAttribute("hidden")).toBe(false);
    expect(q(root, "encode-panels-hero").hasAttribute("hidden")).toBe(true);
    pick(root, "mode", "encode");
    expect(q(root, "encode-fields").hasAttribute("hidden")).toBe(false);
  });

  it("decodes typed fields and says what is wrong with a bad one", async () => {
    const { root } = await mount({
      mode: "decode",
      julianDay: "2440588",
      nanosOfDay: "0",
    });
    expect(slot(card(root, "int96"), "readback")).toBe("1970-01-01T00:00:00Z");
    type(root, "julianDay", "12x");
    expect(slot(card(root, "int96"), "message")).toBe("Type a whole number");
    pick(root, "int96Form", "bytes");
    type(root, "bytes", "zz");
    expect(slot(card(root, "int96"), "message")).toBe("Type 24 hex digits");
  });

  it("round trips through the permalink in both modes", async () => {
    const { handle } = await mount({ preset: "int64-edge" });
    expect(handle.getPermalinkState?.()).toEqual({ preset: "int64-edge" });
    const enc = await mount({
      value: "2024-01-01T00:00:00Z",
      unit: "millisecond",
      zone: "UTC",
    });
    expect(enc.handle.getPermalinkState?.()).toEqual({
      value: "2024-01-01T00:00:00Z",
      unit: "millisecond",
      zone: "UTC",
    });
    const dec = await mount({ mode: "decode", int64: "-1" });
    expect(dec.handle.getPermalinkState?.()).toEqual({
      mode: "decode",
      int64: "-1",
    });
    const again = await mount(
      dec.handle.getPermalinkState?.() as Record<string, string>,
    );
    expect(again.handle.getPermalinkState?.()).toEqual({
      mode: "decode",
      int64: "-1",
    });
  });

  it("keeps the regions and holds of the hold-still contract", async () => {
    const { root } = await mount();
    for (const role of [
      "hero-exact",
      "hero-value",
      "hero-pill",
      "hero-reason",
      "cards",
      "ladder",
      "ladder-list",
      "bridge-output",
    ]) {
      expect(q(root, role), role).toBeTruthy();
    }
    expect(root.querySelectorAll(".gmt-colbridge-card")).toHaveLength(4);
    expect(
      root.querySelectorAll('[data-role="ladder"] [data-slot]'),
    ).toHaveLength(4);
    const before = root.querySelectorAll(".gmt-ledger-hold").length;
    expect(before).toBeGreaterThan(0);
    type(root, "value", "x".repeat(64));
    expect(root.querySelectorAll(".gmt-ledger-hold").length).toBe(before);
    expect(root.querySelectorAll(".gmt-colbridge-card")).toHaveLength(4);
  });

  it("escapes what is typed", async () => {
    const { root } = await mount();
    type(root, "value", '<img src=x onerror="1">');
    type(root, "zone", '<b>"</b>');
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
  });
});

describe("module content", () => {
  it("holds no epoch, unit factor or layout outside the presets", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter(
      (f) =>
        (f.startsWith("column-timestamp-") || f === "column-bridge-lib.ts") &&
        !/\.test\./.test(f) &&
        f !== "column-timestamp-bridge-presets.ts",
    );
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text, f).not.toMatch(
        /2440588|86400000000000|62135596800|1_000_000_000|1e9\b/,
      );
    }
  });
});
