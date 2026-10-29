/**
 * @vitest-environment jsdom
 *
 * What the server-rendered `/dox` shows the reader before it hydrates. The
 * string `renderToString` returns is parsed into a detached document and read
 * with role and text queries. `DoxChat.ssr.test.tsx` is the node-environment
 * half: it proves the same render never touches a browser global.
 */
import { within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { gmtStats } from "~/data/gmt-stats";
import { DoxChat } from "./DoxChat";
import DoxPage from "./DoxPage";
import type { BrainsInfo } from "./use-brains";
import { expectNoAxeViolations } from "~/test/render-widget";

const PACIFIC_MIDNIGHT = "2026-06-16T07:00:00Z";

function budget(visitorRemaining: number): BrainsInfo {
  return {
    brains: [
      {
        id: "gemini-3.8-flash",
        label: "3.8 Flash",
        provider: "google",
        remaining: 20,
        limit: 20,
        state: "ok",
      },
    ],
    providers: [{ id: "google", label: "Gemini", resetsAt: PACIFIC_MIDNIGHT }],
    activeBrainId: "gemini-3.8-flash",
    visitor: {
      used: 5 - visitorRemaining,
      limit: 5,
      remaining: visitorRemaining,
      unlimited: false,
      resetsAt: PACIFIC_MIDNIGHT,
    },
  };
}

/** Pages the tests adopted into the live document, removed after each test. */
const adopted: HTMLElement[] = [];
function removeAdopted(): void {
  for (const body of adopted.splice(0)) body.remove();
}
afterEach(removeAdopted);

/**
 * Server-renders `element` and returns the body of the page the browser would
 * first paint. The parsed body is adopted into the live document, because the
 * role queries and jest-dom need a window the detached document lacks. A
 * later call replaces the earlier page.
 */
function serverPage(element: React.ReactElement): HTMLElement {
  removeAdopted(); // one page, so one main landmark, at a time
  const parsed = new DOMParser().parseFromString(
    `<!doctype html><html><body><main>${renderToString(element)}</main></body></html>`,
    "text/html",
  ).body;
  const body = document.adoptNode(parsed);
  document.body.append(body);
  adopted.push(body);
  return body;
}

describe("DoxChat server-rendered page", () => {
  it("shows the empty state, including the corpus figures", async () => {
    const body = serverPage(<DoxChat />);
    // The pre-hydration markup a reader sees first must be the real empty
    // state, not a blank shell.
    expect(within(body).getByText(/chunks indexed/)).toBeInTheDocument();
    expect(within(body).getByRole("textbox")).toBeInTheDocument();
    await expectNoAxeViolations(body);
  });

  it("shows the note that the answers can be wrong but the widgets are tested", () => {
    const body = serverPage(<DoxChat />);
    // The note shows in the empty state and again in the fine-print popover.
    const notes = within(body).getAllByText(/can get things wrong/);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(note).toHaveTextContent(
        `checked by ${new Intl.NumberFormat("en-US").format(gmtStats.tests)} tests`,
      );
    }
  });

  it("shows the examples rail as pickable examples, not starter pills", async () => {
    const body = serverPage(<DoxPage />);
    const rail = within(body).getByRole("complementary", { name: "Examples" });
    expect(
      within(rail).getByRole("heading", { name: "Examples", level: 2 }),
    ).toBeInTheDocument();
    expect(within(rail).getAllByRole("button").length).toBeGreaterThan(0);
    await expectNoAxeViolations(body);
  });

  it("shows no reset time on the server, where the reader's zone is unknown", async () => {
    // Printing one here would hydrate against a different string in the
    // browser (#418). The chip and the banner's "Back …" arrive after mount.
    const idle = serverPage(<DoxChat brains={budget(5)} />);
    expect(
      within(idle).getByRole("button", { name: /3\.8 Flash/ }),
    ).toBeInTheDocument();
    expect(
      within(idle).queryByRole("button", { name: /Change the zone/ }),
    ).not.toBeInTheDocument();

    const spent = serverPage(<DoxChat brains={budget(0)} />);
    expect(
      within(spent).getByText(/questions for today\./),
    ).not.toHaveTextContent("Back ");
    await expectNoAxeViolations(spent);
  });
});
