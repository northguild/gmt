/**
 * @vitest-environment jsdom
 *
 * The `/dox` fine print on a phone: one info button whose popup holds both the
 * note that free models write the answers and the licence note. CSS decides
 * which form shows (gmt-hive.css, "Fine print"); this covers the markup that
 * the native popover and assistive technology rely on.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { gmtStats } from "~/data/gmt-stats";
import {
  LICENCE_LEAD,
  LICENCE_LINK_TEXT,
  LICENCE_SUMMARY,
  LICENCE_URL,
} from "~/lib/licence";
import { expectNoAxeViolations } from "~/test/render-widget";
import { ChatInfo, LicenceDisclosure } from "./ChatInfo";

// The panel is `display: none` until opened, so its name is empty to the tree.
const BUTTON = "About Dox's answers and licences";

describe("the composer's info button", () => {
  it("is a named button that opens its own popup", async () => {
    const { container } = render(<ChatInfo />);
    const button = screen.getByRole("button", { name: BUTTON });
    const panel = screen.getByRole("region", { hidden: true });
    expect(button).toHaveAttribute("type", "button");
    expect(panel.id).not.toBe("");
    expect(button).toHaveAttribute("popovertarget", panel.id);
    expect(panel).toHaveAttribute("popover", "auto");
    await expectNoAxeViolations(container);
  });

  it("holds both the free-model note and the licence note", async () => {
    const { container } = render(<ChatInfo />);
    const panel = screen.getByRole("region", { hidden: true });
    expect(panel).toHaveTextContent("can get things wrong");
    expect(panel).toHaveTextContent(
      `checked by ${new Intl.NumberFormat("en-US").format(gmtStats.tests)} tests`,
    );
    expect(
      within(panel).getByRole("link", {
        name: LICENCE_LINK_TEXT,
        hidden: true,
      }),
    ).toHaveAttribute("href", LICENCE_URL);
    await expectNoAxeViolations(container);
  });

  it("gives each instance its own popup", async () => {
    const { container } = render(
      <>
        <ChatInfo />
        <ChatInfo />
      </>,
    );
    const buttons = screen.getAllByRole("button", { name: BUTTON });
    const panels = screen.getAllByRole("region", { hidden: true });
    expect(buttons).toHaveLength(2);
    expect(panels).toHaveLength(2);
    expect(panels[0]!.id).not.toBe(panels[1]!.id);
    buttons.forEach((b, i) => {
      expect(b).toHaveAttribute("popovertarget", panels[i]!.id);
    });
    await expectNoAxeViolations(container);
  });
});

describe("the footer's licence line", () => {
  it("is one closed line that opens, from the keyboard, to the full note", async () => {
    const user = userEvent.setup();
    const { container } = render(<LicenceDisclosure />);
    const summary = screen.getByText(LICENCE_SUMMARY);
    expect(summary).toBeVisible();
    expect(screen.getByRole("group")).not.toHaveAttribute("open");
    expect(
      screen.queryByText(LICENCE_LEAD, { exact: false }),
    ).not.toBeVisible();
    await user.tab();
    expect(summary).toHaveFocus();
    // A browser opens a focused summary on Enter and Space; jsdom has no such key handling.
    await user.click(summary);
    expect(screen.getByRole("group")).toHaveAttribute("open");
    expect(
      screen.getByRole("link", { name: LICENCE_LINK_TEXT }),
    ).toHaveAttribute("href", LICENCE_URL);
    await expectNoAxeViolations(container);
  });
});
