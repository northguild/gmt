// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import {
  callFrameContent,
  callFrameHold,
  emptyOutput,
  lostOutput,
  outputContent,
  outputHold,
  valueOutput,
} from "./edi-call";

const call = {
  fn: "parseX12Date",
  args: ["20240615", "D8"],
  result: "2024-06-15",
};

describe("callFrameContent", () => {
  it("is empty when no call was made", () => {
    const { host } = renderHtml(
      callFrameContent({ label: "Call made", calls: [] }),
    );
    expect(host).toBeEmptyDOMElement();
  });

  it("names the frame and prints the call", async () => {
    const { host } = renderHtml(
      callFrameContent({ label: "Call made", calls: [call] }),
    );
    expect(screen.getByRole("group", { name: "Call made" })).toHaveTextContent(
      'parseX12Date("20240615", "D8")',
    );
    expect(
      screen.getByRole("button", { name: /Copy call/ }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });
});

describe("callFrameHold", () => {
  it("shows the live frame and keeps its reserved ones out of the page", async () => {
    const { host } = renderHtml(
      callFrameHold({
        id: "c-1",
        spec: { label: "Call made", calls: [call] },
        samples: ["a much longer call that the frame may hold"],
      }),
    );
    expect(
      screen.getByRole("group", { name: "Call made" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/much longer call/, {
        ignore: '[aria-hidden="true"], [aria-hidden="true"] *',
      }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(host);
  });
});

describe("outputContent", () => {
  it("shows a value, plain words, and the sentinel in words", async () => {
    const { host } = renderHtml(
      outputContent("Result", valueOutput('"20240615"')),
    );
    expect(screen.getByRole("status", { name: "Result" })).toHaveTextContent(
      '"20240615"',
    );
    await expectNoAxeViolations(host);
  });

  it("says nothing to read in words and not as the sentinel", () => {
    renderHtml(outputContent("Result", emptyOutput("nothing to read")));
    const out = screen.getByRole("status", { name: "Result" });
    expect(out).toHaveTextContent("nothing to read");
    expect(out).not.toHaveTextContent("NO SIGNAL");
  });

  it("shows NO SIGNAL for a refused read", () => {
    renderHtml(outputContent("Result", lostOutput()));
    expect(screen.getByRole("status", { name: "Result" })).toHaveTextContent(
      "NO SIGNAL",
    );
  });
});

describe("outputHold", () => {
  it("shows the live pane and keeps the reserved texts out of the page", async () => {
    const { host } = renderHtml(
      outputHold({
        id: "o-1",
        label: "Result",
        state: emptyOutput("nothing to read"),
        samples: ["a longer result the pane may hold"],
      }),
    );
    expect(screen.getByRole("status", { name: "Result" })).toHaveTextContent(
      "nothing to read",
    );
    expect(
      screen.queryByText(/longer result/, {
        ignore: '[aria-hidden="true"], [aria-hidden="true"] *',
      }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(host);
  });
});
