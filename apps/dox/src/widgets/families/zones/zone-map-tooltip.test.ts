// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { zoneMapTooltip } from "./zone-map-tooltip";

describe("zoneMapTooltip", () => {
  it("shows the zone name, then the time and the offset", async () => {
    const r = renderHtml(
      zoneMapTooltip({
        name: "Asia/Tokyo",
        time: "2027-03-08T07:00:00",
        offset: "+09:00",
      }),
    );
    expect(screen.getByText("Asia/Tokyo")).toBeInTheDocument();
    expect(screen.getByText("2027-03-08T07:00:00")).toBeInTheDocument();
    expect(screen.getByText("GMT+09:00")).toBeInTheDocument();
    await expectNoAxeViolations(r.host);
  });

  it("escapes a name that carries markup", () => {
    renderHtml(
      zoneMapTooltip({ name: "<b>x</b>", time: "t", offset: "+00:00" }),
    );
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });
});
