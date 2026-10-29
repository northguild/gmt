/**
 * @vitest-environment jsdom
 *
 * `crossingConnector`: the blank strip of text between the two faces, ready to be filled.
 */
import { screen } from "@testing-library/dom";
import { renderHtml } from "~/widgets/test-fixture";
import { crossingConnector } from "./crossing-connector";

describe("crossingConnector", () => {
  it("holds a blank elapsed status, ready to be filled", () => {
    renderHtml(
      crossingConnector({
        elapsedId: "t-elapsed",
        naiveId: "t-naive",
        area: "co",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/^\s*$/);
  });
});
