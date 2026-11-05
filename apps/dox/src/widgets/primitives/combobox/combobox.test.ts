// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { field } from "../../builders";
import { renderHtml } from "../../test-fixture";
import { combobox, type GmtCombobox } from "./combobox";
import { listboxRootClass } from "../listbox/listbox";

const zones = ["Africa/Cairo", "Asia/Tokyo", "Asia/Seoul", "Europe/Paris"];

function draw(browse = false, placement?: "above" | "below") {
  return renderHtml(
    field({
      id: "zone",
      label: "Find a zone",
      control: ({ id }) =>
        combobox({
          id,
          label: "Find a zone",
          items: zones,
          placeholder: "e.g. Asia/Tokyo",
          ...(browse ? { browseLabel: "Browse every zone" } : {}),
          ...(placement ? { placement } : {}),
        }),
    }),
  );
}

describe("the combobox popup", () => {
  it("is the listbox with its own background, border and scrolling", () => {
    draw();
    expect(listboxRootClass).toBeTruthy();
    // The shared root class is the contract with Zone Planner; the popup is a bare custom element with no role.
    // oxlint-disable-next-line dox-test/no-class-query, dox-test/no-house-class, testing-library/no-node-access
    const popup = document.querySelector("gmt-listbox");
    // oxlint-disable-next-line dox-test/no-implementation-assert, dox-test/no-class-query
    expect(popup).toHaveClass(listboxRootClass);
  });
});

describe("the combobox element", () => {
  it("opens, narrows and chooses the same when it is set to open above the input", async () => {
    const r = draw(false, "above");
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    await user.keyboard("seo");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveValue(
      "Asia/Seoul",
    );
    await expectNoAxeViolations(r.host);
  });

  it("is named by its label and opens with every choice on focus", async () => {
    draw();
    const user = userEvent.setup();
    await user.tab();
    const input = screen.getByRole("combobox", { name: "Find a zone" });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("narrows the choices as you type, ignoring case, and lists every match", async () => {
    draw();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Find a zone" }));
    await user.keyboard("ASIA");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(
      screen.getByRole("option", { name: "Asia/Tokyo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Asia/Seoul" }),
    ).toBeInTheDocument();
  });

  it("moves with the arrow keys and chooses with Enter", async () => {
    const fx = draw();
    const seen: string[] = [];
    fx.host.addEventListener("change", (e) =>
      seen.push((e as CustomEvent<{ value: string }>).detail.value),
    );
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: "Find a zone" });
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Asia/Tokyo" }).id,
    );
    await user.keyboard("{Enter}");
    expect(seen).toEqual(["Asia/Tokyo"]);
    expect(input).toHaveValue("Asia/Tokyo");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await expectNoAxeViolations(fx.host);
  });

  it("wraps up from the top and opens a shut list on ArrowDown and on Alt+ArrowDown", async () => {
    draw();
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: "Find a zone" });
    await user.click(input);
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Europe/Paris" }).id,
    );
  });

  it("chooses an exact id typed in full, and ignores a partial one", async () => {
    const fx = draw();
    const seen: string[] = [];
    fx.host.addEventListener("change", (e) =>
      seen.push((e as CustomEvent<{ value: string }>).detail.value),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Find a zone" }));
    await user.keyboard("Asia/Tok{Enter}");
    expect(seen).toEqual([]);
    await user.keyboard("yo{Enter}");
    expect(seen).toEqual(["Asia/Tokyo"]);
  });

  it("closes on Escape and on Tab", async () => {
    draw();
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: "Find a zone" });
    await user.click(input);
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.tab();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("takes focus from code without opening, and opens on the first key typed", async () => {
    draw();
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: "Find a zone" });
    // The combobox's own method is the contract the zone drawer's magnifier relies on.
    // oxlint-disable-next-line dox-test/no-class-query, dox-test/no-house-class, testing-library/no-node-access
    (document.querySelector("gmt-combobox") as GmtCombobox).focusInput();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("s");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveValue("s");
  });

  it("reports a choice, and never the input's own change when typed text is left", async () => {
    draw();
    const user = userEvent.setup();
    const seen: unknown[] = [];
    // The element's `change` is the contract the globe search listens to.
    // oxlint-disable-next-line dox-test/no-class-query, dox-test/no-house-class, testing-library/no-node-access
    const element = document.querySelector("gmt-combobox");
    element?.addEventListener("change", (event) => {
      seen.push((event as CustomEvent<{ value: string }>).detail?.value);
    });
    await user.click(screen.getByRole("combobox", { name: "Find a zone" }));
    await user.keyboard("zz");
    await user.tab();
    expect(seen).toEqual([]);
    await user.click(screen.getByRole("combobox", { name: "Find a zone" }));
    await user.clear(screen.getByRole("combobox", { name: "Find a zone" }));
    await user.click(screen.getByRole("option", { name: "Asia/Tokyo" }));
    expect(seen).toEqual(["Asia/Tokyo"]);
  });

  it("chooses the option a click lands on and keeps focus in the input", async () => {
    const fx = draw();
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: "Find a zone" });
    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Europe/Paris" }));
    expect(input).toHaveValue("Europe/Paris");
    expect(input).toHaveFocus();
    await expectNoAxeViolations(fx.host);
  });

  it("the browse button opens and shuts the full list and mirrors the state", async () => {
    const fx = draw(true);
    const user = userEvent.setup();
    const browse = screen.getByRole("button", { name: "Browse every zone" });
    const opens: boolean[] = [];
    fx.host.addEventListener("openchange", (e) =>
      opens.push((e as CustomEvent<{ open: boolean }>).detail.open),
    );
    await user.click(browse);
    expect(browse).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(4);
    await user.click(browse);
    expect(browse).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveFocus();
    expect(opens).toEqual([true, false]);
    await expectNoAxeViolations(fx.host);
  });

  it("takes a value and a new list from code", async () => {
    const fx = draw();
    const el = fx.element<GmtCombobox>("combobox");
    el.value = "Asia/Seoul";
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveValue(
      "Asia/Seoul",
    );
    el.items = ["Pacific/Fiji"];
    await userEvent
      .setup()
      .click(screen.getByRole("combobox", { name: "Find a zone" }));
    await userEvent
      .setup()
      .clear(screen.getByRole("combobox", { name: "Find a zone" }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});
