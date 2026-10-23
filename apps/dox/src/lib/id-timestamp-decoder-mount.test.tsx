/**
 * @vitest-environment jsdom
 *
 * The ID Timestamp Decoder end to end against the real `@northguild/gmt`.
 * Every preset's rows are literal values read once from a run of the built
 * library, and they agree with the slice's table. A drift in the library or in
 * the widget fails here.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installJsdomShims } from "~/test/jsdom-shims";
import { ID_PRESETS } from "./id-timestamp-decoder";
import {
  mountIdTimestampDecoder,
  renderIdTimestampDecoderTemplate,
} from "./id-timestamp-decoder-mount";

installJsdomShims();

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderIdTimestampDecoderTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountIdTimestampDecoder(root, args, controller.signal);
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

const NOT = "not-called";

/** Read once from the built library; the fn keys are the rows, `""`/`null` the sentinels. */
const RECORDED: Record<string, { hero: string; rows: Record<string, string> }> =
  {
    "uuid-v7": {
      hero: "one",
      rows: {
        fromUuidTimestamp: '{ instant: "2022-02-22T19:22:22Z", version: 7 }',
        fromUlid: '""',
        fromObjectId: '""',
        fromKsuid: '""',
        fromSnowflake: NOT,
      },
    },
    "uuid-v1": {
      hero: "one",
      rows: {
        fromUuidTimestamp: '{ instant: "2022-02-22T19:22:22Z", version: 1 }',
      },
    },
    "uuid-v6": {
      hero: "one",
      rows: {
        fromUuidTimestamp: '{ instant: "2022-02-22T19:22:22Z", version: 6 }',
      },
    },
    "uuid-v4": {
      hero: "none",
      rows: { fromUuidTimestamp: "null", fromUlid: '""' },
    },
    "uuid-urn": {
      hero: "none",
      rows: { fromUuidTimestamp: "null", fromKsuid: '""' },
    },
    ulid: {
      hero: "one",
      rows: {
        fromUlid: '"2016-07-30T23:54:10.259Z"',
        fromUuidTimestamp: "null",
      },
    },
    "ulid-letter-i": {
      hero: "none",
      rows: { fromUlid: '""', fromUuidTimestamp: "null" },
    },
    objectid: { hero: "one", rows: { fromObjectId: '"2024-01-12T08:14:08Z"' } },
    "objectid-2038": {
      hero: "one",
      rows: { fromObjectId: '"2038-01-19T03:14:08Z"' },
    },
    ksuid: { hero: "one", rows: { fromKsuid: '"2017-10-10T04:00:47Z"' } },
    "ksuid-lower": {
      hero: "one",
      rows: { fromKsuid: '"2017-10-10T04:00:51Z"' },
    },
    "sf-1420070400000-22": {
      hero: "one",
      rows: { fromSnowflake: '"2016-04-30T11:18:25.796Z"', fromUlid: '""' },
    },
    "sf-1288834974657-22-41": {
      hero: "one",
      rows: { fromSnowflake: '"2018-10-10T20:19:24.211Z"' },
    },
    "sf-other-epoch": {
      hero: "one",
      rows: { fromSnowflake: '"2022-12-07T18:36:29.554Z"' },
    },
  };

const rowText = (root: HTMLElement, fn: string) => {
  const tr = root.querySelector<HTMLElement>(`tr[data-fn="${fn}"]`)!;
  const returned = tr.querySelectorAll("td")[2]!;
  // The hold stacks hidden sizers; the live cell is the first child.
  const live = returned.querySelector(".gmt-iddecode-cell")!;
  return {
    state: tr.dataset["state"]!,
    text: (live.textContent ?? "").replace(/\s+/g, " ").trim(),
  };
};

describe("presets against the real library", () => {
  it("records a result for every preset", () => {
    expect(Object.keys(RECORDED).sort()).toEqual(
      ID_PRESETS.map((p) => p.id).sort(),
    );
  });

  for (const p of ID_PRESETS) {
    it(`reads ${p.id}`, async () => {
      const { root, handle } = await mount({ preset: p.id });
      const want = RECORDED[p.id]!;
      expect(q(root, "hero-reading").dataset["state"]).toBe(want.hero);
      for (const [fn, text] of Object.entries(want.rows)) {
        const got = rowText(root, fn);
        if (text === NOT) {
          expect(got.state).toBe("not-called");
        } else {
          expect(got.text.replace(/​/g, "")).toBe(text);
        }
      }
      // Exactly the rows the hero names read.
      const read = [...root.querySelectorAll("tr[data-state='read']")].length;
      expect(read).toBe(want.hero === "one" ? 1 : 0);
      handle.destroy();
    });
  }
});

describe("behaviour", () => {
  it("opens on the default with only the version showing", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("uuid-v7");
    expect(q(root, "hero-version").hasAttribute("data-off")).toBe(false);
    expect(q(root, "hero-pill").hasAttribute("data-off")).toBe(true);
  });

  it("shows NO SIGNAL only when every decoder returned its sentinel", async () => {
    const { root } = await mount({ preset: "uuid-v4" });
    expect(q(root, "hero-pill").hasAttribute("data-off")).toBe(false);
    choose(root, "ulid");
    expect(q(root, "hero-pill").hasAttribute("data-off")).toBe(true);
  });

  it("fills the inputs from a preset and switches to Your values on typing", async () => {
    const { root } = await mount();
    choose(root, "sf-1420070400000-22");
    expect(q<HTMLInputElement>(root, "id").value).toBe("175928847299117063");
    expect(q<HTMLInputElement>(root, "epoch").value).toBe("1420070400000");
    expect(q<HTMLInputElement>(root, "shift").value).toBe("22");
    type(root, "id", "175928847299117064");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    choose(root, "custom");
    expect(q<HTMLInputElement>(root, "id").value).toBe("175928847299117064");
  });

  it("makes no Snowflake call without a layout, and says why", async () => {
    const { root } = await mount({ id: "175928847299117063" });
    const got = rowText(root, "fromSnowflake");
    expect(got.state).toBe("not-called");
    expect(got.text).toContain("Give an epoch and a shift");
  });

  it("makes no Snowflake call with an epoch but no shift", async () => {
    const { root } = await mount({
      id: "175928847299117063",
      epochMs: "1420070400000",
    });
    const got = rowText(root, "fromSnowflake");
    expect(got.state).toBe("not-called");
    expect(got.text).toContain(
      "Give an epoch and a shift: a Snowflake has no default layout.",
    );
  });

  it("round trips through the permalink", async () => {
    const { handle } = await mount({ preset: "ksuid" });
    expect(handle.getPermalinkState?.()).toEqual({ preset: "ksuid" });
    const custom = await mount({ id: "abc", epochMs: "1", shift: "2" });
    expect(custom.handle.getPermalinkState?.()).toEqual({
      id: "abc",
      epochMs: "1",
      shift: "2",
    });
  });

  it("keeps the regions and holds of the hold-still contract", async () => {
    const { root } = await mount();
    for (const role of [
      "hero-reading",
      "hero-value",
      "hero-pill",
      "hero-version",
      "hero-reason",
      "rows",
      "ids-output",
    ]) {
      expect(q(root, role), role).toBeTruthy();
    }
    expect(root.querySelectorAll("tbody tr")).toHaveLength(5);
    // Every body row cell that changes sits in a hold with a sizer.
    for (const tr of root.querySelectorAll("tbody tr")) {
      expect(tr.querySelectorAll(".gmt-ledger-hold").length).toBe(2);
      expect(tr.querySelectorAll(".gmt-edi-sizer").length).toBeGreaterThan(1);
    }
    // Typing a 64 character id does not change the number of rows or holds.
    const before = root.querySelectorAll(".gmt-ledger-hold").length;
    type(root, "id", "x".repeat(64));
    expect(root.querySelectorAll(".gmt-ledger-hold").length).toBe(before);
  });

  it("escapes what is typed", async () => {
    const { root } = await mount();
    type(root, "id", '<img src=x onerror="1">');
    expect(root.querySelector("img")).toBeNull();
  });
});

describe("module content", () => {
  it("holds no epoch, unit factor or ID grammar", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter(
      (f) =>
        (f.startsWith("id-timestamp-") || f === "identifier-lib.ts") &&
        !/\.test\./.test(f),
    );
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text, f).not.toMatch(
        /1582|1400000000|0x01B21DD213814000|0123456789ABCDEFGHJKMNPQRSTVWXYZ/i,
      );
    }
  });
});
