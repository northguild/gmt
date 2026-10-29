// @vitest-environment jsdom
import { TRANSPORT_ZONES } from "~/lib/cutoff-widgets";
import { setSelectValue, zoneChoices } from "./zone-choices";

describe("zoneChoices", () => {
  it("is the curated list for a curated zone or none", () => {
    expect(zoneChoices("Europe/Amsterdam")).toHaveLength(
      TRANSPORT_ZONES.length,
    );
    expect(zoneChoices("")).toHaveLength(TRANSPORT_ZONES.length);
  });

  it("keeps a seeded zone outside the list, last", () => {
    const list = zoneChoices("Pacific/Fiji");
    expect(list).toHaveLength(TRANSPORT_ZONES.length + 1);
    expect(list.at(-1)).toEqual({
      value: "Pacific/Fiji",
      label: "Pacific/Fiji",
    });
  });
});

describe("setSelectValue", () => {
  it("adds the option a seed names and selects it", () => {
    const el = document.createElement("select");
    el.add(new Option("a", "a"));
    setSelectValue(el, "b");
    expect(el.value).toBe("b");
    expect(el.options).toHaveLength(2);
  });

  it("selects a listed value without adding one", () => {
    const el = document.createElement("select");
    el.add(new Option("a", "a"));
    el.add(new Option("b", "b"));
    setSelectValue(el, "b");
    expect(el.value).toBe("b");
    expect(el.options).toHaveLength(2);
  });
});
