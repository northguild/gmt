/**
 * @vitest-environment jsdom
 *
 * The `/dox` fine print on a phone: one info button whose popup holds both the
 * note that free models write the answers and the licence note. CSS decides
 * which form shows (gmt-hive.css, "Fine print"); this covers the markup that
 * the native popover and assistive technology rely on.
 */
import { render, screen, within } from "@testing-library/react";
import { gmtStats } from "~/data/gmt-stats";
import { LICENCE_LINK_TEXT, LICENCE_URL } from "~/lib/licence";
import { ChatInfo } from "./ChatInfo";

describe("the composer's info button", () => {
  it("is a named button that opens its own popup", () => {
    render(<ChatInfo />);
    const button = screen.getByRole("button", {
      name: "About Dox's answers and licences",
    });
    expect(button.getAttribute("type")).toBe("button");
    const panelId = button.getAttribute("popovertarget");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId ?? "");
    expect(panel?.getAttribute("popover")).toBe("auto");
  });

  it("holds both the free-model note and the licence note", () => {
    render(<ChatInfo />);
    const button = screen.getByRole("button", {
      name: "About Dox's answers and licences",
    });
    const panel = document.getElementById(
      button.getAttribute("popovertarget") ?? "",
    ) as HTMLElement;
    expect(panel.textContent).toContain("can get things wrong");
    expect(panel.textContent).toContain(
      `checked by ${new Intl.NumberFormat("en-US").format(gmtStats.tests)} tests`,
    );
    const link = within(panel).getByRole("link", {
      name: LICENCE_LINK_TEXT,
      hidden: true,
    });
    expect(link.getAttribute("href")).toBe(LICENCE_URL);
  });

  it("gives each instance its own popup", () => {
    render(
      <>
        <ChatInfo />
        <ChatInfo />
      </>,
    );
    const ids = screen
      .getAllByRole("button", { name: "About Dox's answers and licences" })
      .map((b) => b.getAttribute("popovertarget"));
    expect(new Set(ids).size).toBe(2);
  });
});
