// @vitest-environment jsdom
import { isInaccessible, screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "./html";
import { renderHtml } from "../test-fixture";
import { axis, lane, mark, tick, unit } from "./timeline";

describe("timeline", () => {
  it("is a group named by its label that holds named marks", () => {
    renderHtml(
      lane({ label: "Rotterdam" }, [
        mark({ label: "Gate closes 17:00", at: 0.7 }),
        mark({ label: "Free time", at: 0.1, span: 0.4, series: 2 }),
      ]),
    );
    const group = screen.getByRole("group", { name: "Rotterdam" });
    expect(
      within(group).getByRole("img", { name: "Gate closes 17:00" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("img", { name: "Free time" }),
    ).toBeInTheDocument();
  });

  it("clamps a position to 0..1 and reads a non-finite one as the start", () => {
    expect(unit(0.25)).toBe("0.25");
    expect(unit(-3)).toBe("0");
    expect(unit(9)).toBe("1");
    expect(unit(Number.NaN)).toBe("0");
    expect(unit(Number.POSITIVE_INFINITY)).toBe("0");
  });

  it("draws the axis ticks as text for the eye only", () => {
    renderHtml(
      axis([tick({ at: 0, label: "00:00" }), tick({ at: 1, label: "24:00" })]),
    );
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(isInaccessible(screen.getByText("00:00"))).toBe(true);
  });

  it("escapes a label", () => {
    renderHtml(lane({ label: '"><b>x' }, mark({ label: "<i>", at: 0.5 })));
    expect(screen.getByRole("group", { name: '"><b>x' })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "<i>" })).toBeInTheDocument();
  });

  describe("emphasis", () => {
    it("marks only the emphasised mark as current, and keeps every name", () => {
      renderHtml(
        lane({ label: "Candidates" }, [
          mark({ label: "Chosen 30 Jun", at: 0.5, emphasis: true }),
          mark({ label: "Other 31 May", at: 0.2, emphasis: false }),
          mark({ label: "Plain 31 Jul", at: 0.8 }),
        ]),
      );
      expect(
        screen.getByRole("img", { name: "Chosen 30 Jun", current: true }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("img", { current: true })).toHaveLength(1);
      expect(
        screen.getByRole("img", { name: "Other 31 May" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("img", { name: "Plain 31 Jul" }),
      ).toBeInTheDocument();
    });

    it("renders an unemphasised mark exactly as it did without the option", () => {
      const base = { label: "Gate", at: 0.5, series: 2 as const };
      expect(String(mark({ ...base, emphasis: false }))).toBe(
        String(mark(base)),
      );
      renderHtml(mark(base));
      expect(screen.getByRole("img", { name: "Gate" })).toBeInTheDocument();
      expect(screen.queryAllByRole("img", { current: true })).toHaveLength(0);
    });
  });

  it("has no axe violations", async () => {
    const r = renderHtml(
      html`${lane({ label: "Lane A" }, [
        mark({ label: "Point", at: 0.5 }),
        mark({ label: "Range", at: 0.2, span: 0.3, series: 3 }),
      ])}${axis([tick({ at: 0, label: "0" }), tick({ at: 1, label: "1" })])}`,
    );
    await expectNoAxeViolations(r.host);
  });
});
