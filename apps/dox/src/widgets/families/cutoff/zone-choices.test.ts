// @vitest-environment jsdom
import { expectNoAxeViolations } from "~/test/render-widget";
import { screen } from "@testing-library/dom";
import { TRANSPORT_ZONES } from "~/lib/cutoff-widgets";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
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

describe("a select built from the choices", () => {
  it("has no axe violations, with a seeded zone added", async () => {
    const options = zoneChoices("Pacific/Fiji").map(
      (c) => html`<option value="${c.value}">${c.label}</option>`,
    );
    const { host } = renderHtml(
      html`<label
        >Zone
        <select>
          ${options}
        </select></label
      >`,
    );
    await expectNoAxeViolations(host);
    const select = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Zone",
    });
    setSelectValue(select, "Asia/Tokyo");
    await expectNoAxeViolations(host);
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
