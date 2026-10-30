// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html } from "../../builders/html";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { ruleCard, type RuleCardOptions } from "./rule-card";

const base = (over: Partial<RuleCardOptions> = {}): RuleCardOptions => ({
  id: "r1",
  index: 0,
  total: 2,
  kind: "fixed",
  kindOptions: [
    { value: "fixed", label: "Fixed date" },
    { value: "dates", label: "Listed dates" },
  ],
  name: "Christmas",
  maxName: 40,
  fields: html`<span>fields</span>`,
  result: html`<p>result</p>`,
  ...over,
});

const list = (card: ReturnType<typeof ruleCard>) => html`<ol>${card}</ol>`;

describe("ruleCard", () => {
  it("names each control for its rule", () => {
    renderHtml(list(ruleCard(base({ index: 1, total: 3 }))));
    expect(screen.getByRole("textbox", { name: "Rule 2 name" })).toHaveValue(
      "Christmas",
    );
    expect(screen.getByRole("combobox", { name: "Rule 2 kind" })).toHaveValue(
      "fixed",
    );
    expect(
      screen.getByRole("button", { name: "Move rule 2 up" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Move rule 2 down" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove rule 2" })).toBeEnabled();
  });

  it("disables up on the first rule and down on the last", () => {
    renderHtml(list(ruleCard(base())));
    expect(
      screen.getByRole("button", { name: "Move rule 1 up" }),
    ).toBeDisabled();
    renderHtml(list(ruleCard(base({ id: "r2", index: 1 }))));
    expect(
      screen.getByRole("button", { name: "Move rule 2 down" }),
    ).toBeDisabled();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(list(ruleCard(base())));
    await expectNoAxeViolations(host);
  });
});
