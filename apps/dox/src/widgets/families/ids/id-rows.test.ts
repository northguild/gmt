// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { cellsInColumn } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { idRows, type IdRowView } from "./id-rows";

const rows: IdRowView[] = [
  {
    fn: "fromUlid",
    format: "ULID",
    state: "read",
    status: "Read",
    call: html`<code>fromUlid("x")</code>`,
    returned: html`<code>"2016-07-30T23:54:10.259Z"</code>`,
  },
  {
    fn: "fromKsuid",
    format: "KSUID",
    state: "not-called",
    status: "Not read",
    call: html`<p>Not called</p>`,
    returned: html`<p>Give an epoch and a shift.</p>`,
  },
];

const open = () =>
  renderHtml(
    idRows({
      caption: "What each decoder reads",
      rows,
      callSamples: ["fromSnowflake(…)"],
      returnedSamples: ["a long returned text"],
    }),
  );

describe("idRows", () => {
  it("is a named region holding a table with a row for each decoder", () => {
    open();
    expect(
      screen.getByRole("region", { name: "What each decoder reads" }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: "What each decoder reads",
    });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    const [ulid, ksuid] = cellsInColumn(table, "Format");
    expect(ulid).toHaveTextContent("ULIDRead");
    expect(ksuid).toHaveTextContent("KSUIDNot read");
  });

  it("marks a row's state", () => {
    open();
    const row = screen.getByRole("row", { name: /ULID/ });
    expect(row).toHaveTextContent(/Read/);
    expect(screen.getByRole("row", { name: /KSUID/ })).toHaveTextContent(
      /Not read/,
    );
  });

  it("keeps ghost text out of the cells' words", () => {
    open();
    const table = screen.getByRole("table");
    const returned = cellsInColumn(table, "Returned");
    expect(within(returned[1]!).getByRole("paragraph")).toHaveTextContent(
      "Give an epoch and a shift.",
    );
  });

  it("has no axe violations", async () => {
    const { host } = open();
    await expectNoAxeViolations(host);
  });
});
