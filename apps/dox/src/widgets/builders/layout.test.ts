// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { html } from "./html";
import { card, field, fieldGrid, hint, section, widget } from "./layout";

describe("layout builders", () => {
  it("widget is a named region", () => {
    renderHtml(
      widget(
        { name: "demo", label: "Demo tool", scope: "t" },
        card(html`<p>body</p>`),
      ),
    );
    expect(screen.getByRole("region", { name: "Demo tool" })).toHaveTextContent(
      "body",
    );
  });

  it("section is named by its heading at the chosen level", () => {
    renderHtml(
      section({ id: "s1", heading: "Inputs", level: 3 }, html`<p>x</p>`),
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Inputs" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inputs" })).toBeInTheDocument();
  });

  it("field joins label, control and hint", () => {
    const h = hint("t-hint", "Local wall time");
    renderHtml(
      fieldGrid(
        field({
          id: "t",
          label: "Time",
          hint: h,
          control: ({ id, describedBy }) =>
            html`<input
              id="${id}"
              type="text"
              aria-describedby="${describedBy}"
            />`,
        }),
      ),
    );
    expect(
      screen.getByRole("textbox", { name: "Time" }),
    ).toHaveAccessibleDescription("Local wall time");
  });

  it("field without a hint passes no describedBy", () => {
    renderHtml(
      field({
        id: "t",
        label: "Time",
        control: ({ id, describedBy }) => {
          expect(describedBy).toBeUndefined();
          return html`<input id="${id}" type="text" />`;
        },
      }),
    );
    expect(screen.getByRole("textbox", { name: "Time" })).toBeInTheDocument();
  });

  it("types: field requires a label", () => {
    // @ts-expect-error label is required
    const bad: Parameters<typeof field>[0] = { id: "x", control: () => html`` };
    expect(bad.id).toBe("x");
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(
      widget(
        { name: "demo", label: "Demo tool", scope: "t" },
        section(
          { id: "s", heading: "Inputs", level: 2 },
          field({
            id: "t",
            label: "Time",
            control: ({ id }) => html`<input id="${id}" type="text" />`,
          }),
        ),
      ),
    );
    await expectNoAxeViolations(fx.host);
  });
});
