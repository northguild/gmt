/// <reference types="vitest/globals" />
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import AskDoxProbe from "./AskDoxProbe";

// DOX-C0 (#171) — proves the React + Tailwind + AI Elements wiring is real,
// not just theoretical: the island renders, a message from the stub
// conversation appears, and the composer is a real <textarea> (the epic's
// "restyle native elements, never rebuild them" rule — visual-design.md
// §Controls).
//
// describe/it/expect/beforeAll/afterEach come from vitest's `globals: true`
// (vitest.config.ts) — no import needed, per the repo's test convention.
describe("AskDoxProbe", () => {
  beforeAll(() => {
    // jsdom (still true as of v30) doesn't implement ResizeObserver, which
    // Conversation's use-stick-to-bottom needs to track scroll size. A real
    // browser has this; only the test environment doesn't.
    if (!("ResizeObserver" in globalThis)) {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    }
  });

  afterEach(cleanup);

  it("renders the stub conversation and a real textarea composer", () => {
    render(<AskDoxProbe />);

    expect(
      screen.getByText(/convert a utc timestamp to tokyo time/i),
    ).toBeTruthy();

    const textarea = screen.getByPlaceholderText(/ask about @northguild\/gmt/i);
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("renders the markdown-rich reply as real heading elements", () => {
    render(<AskDoxProbe />);

    const heading = screen.getByRole("heading", {
      name: /converting between zones/i,
    });
    expect(heading.tagName).toBe("H1");
  });
});
