// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { dstTicker, dstTicks, DST_HANDLE_LABEL } from "./dst-ticker";

const id = (local: string): string => `t-${local}`;

describe("dstTicker", () => {
  it("is hidden until the mount has a transition, and holds one named slider", async () => {
    const fx = renderHtml(dstTicker({ id }));
    expect(
      screen.queryByRole("slider", { name: DST_HANDLE_LABEL }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: DST_HANDLE_LABEL, hidden: true }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(fx.host);
  });

  it("writes the ticks as text a reader can see", () => {
    renderHtml(
      html`${dstTicks([
        { at: 10, text: "01:00", major: true },
        { at: 50, text: "02:00", major: false },
      ])}`,
    );
    expect(screen.getByText("01:00")).toBeInTheDocument();
    expect(screen.getByText("02:00")).toBeInTheDocument();
  });
});
