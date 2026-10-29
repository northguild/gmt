// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { field } from "../../builders";
import { renderHtml } from "../../test-fixture";
import { combobox, type GmtCombobox } from "./combobox";

const zones = ["Africa/Cairo", "Asia/Tokyo", "Asia/Seoul", "Europe/Paris"];

function draw(browse = false) {
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
        }),
    }),
  );
}

describe("the combobox element", () => {
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
