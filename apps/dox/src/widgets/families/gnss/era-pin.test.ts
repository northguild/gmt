// @vitest-environment jsdom
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { eraPin } from "./era-pin";

describe("eraPin", () => {
  it("is drawn only: hidden from assistive technology", () => {
    const { host } = renderHtml(eraPin({ chosen: true, empty: false }));
    expect(host.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(host).toHaveTextContent("");
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(eraPin({ chosen: false, empty: false }));
    await expectNoAxeViolations(host);
  });
});
