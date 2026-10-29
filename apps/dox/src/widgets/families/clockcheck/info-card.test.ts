// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { CANADA_MINIMUMS } from "~/data/canada-runtime-minimums";
import { MOROCCO_MINIMUMS } from "~/data/morocco-runtime-minimums";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { minimumsCard, serversCard } from "./info-card";

const SERVERS = {
  idPrefix: "x",
  command: "node -e 1",
  expected: [
    ["Vancouver", "-07:00"],
    ["Toronto", "-04:00"],
  ],
  line: "Run this.",
} as const;

describe("serversCard", () => {
  it("is a section named by its heading, with the command and the expected output", () => {
    renderHtml(serversCard(SERVERS));
    const card = screen.getByRole("region", { name: "Test your own servers" });
    expect(card).toHaveTextContent("Run this.");
    expect(
      within(card).getByRole("group", { name: "Node command" }),
    ).toHaveTextContent("node -e 1");
    expect(card).toHaveTextContent(
      "Expected: Vancouver -07:00 · Toronto -04:00",
    );
  });

  it("takes a title of its own and a heading id of its own", () => {
    renderHtml(serversCard({ ...SERVERS, title: "Your servers" }));
    renderHtml(serversCard({ ...SERVERS, idPrefix: "y" }));
    expect(
      screen.getByRole("region", { name: "Your servers" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(2);
  });

  it("has a command button a keyboard can reach", async () => {
    const user = userEvent.setup();
    renderHtml(serversCard(SERVERS));
    const button = screen.getByRole("button", { name: "Copy the command" });
    await user.tab();
    expect(button).toHaveFocus();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(serversCard(SERVERS));
    await expectNoAxeViolations(host);
  });
});

describe.each([
  ["Canada", CANADA_MINIMUMS],
  ["Morocco", MOROCCO_MINIMUMS],
])("minimumsCard for %s", (_name, text) => {
  it("names the card by its heading and lists every row", () => {
    renderHtml(minimumsCard("x", text));
    const card = screen.getByRole("region", { name: text.heading });
    expect(within(card).getAllByRole("listitem")).toHaveLength(
      text.rows.length,
    );
    expect(card).toHaveTextContent(text.intro);
    expect(card).toHaveTextContent(text.note);
  });

  it("links every source with a safe rel", () => {
    renderHtml(minimumsCard("x", text));
    for (const row of text.rows) {
      for (const source of row.sources) {
        const link = screen
          .getAllByRole("link", { name: source.label })
          .find((el) => el.getAttribute("href") === source.href);
        expect(link, `${row.name}: ${source.label}`).toHaveAttribute(
          "rel",
          "noopener noreferrer",
        );
      }
    }
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(minimumsCard("x", text));
    await expectNoAxeViolations(host);
  });
});
