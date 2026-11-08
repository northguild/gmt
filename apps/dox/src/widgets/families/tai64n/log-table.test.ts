// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { LINE_NO_SIGNAL, logTable, type LogRow } from "./log-table";

const read: LogRow = {
  n: 1,
  selected: true,
  token: "@40000000586846a400000000",
  message: "the inserted second",
  read: true,
  utc: "2016-12-31T23:59:60Z",
  offset: "36 s",
  inserted: true,
};

const refused: LogRow = {
  n: 2,
  selected: false,
  token: "",
  message: "@40000000659200a500000000 leading space",
  read: false,
  utc: "",
  offset: "",
  inserted: false,
};

const draw = (rows: readonly LogRow[]) =>
  renderHtml(
    logTable({
      caption: "Each log line",
      group: "log-lines",
      emptyText: "Paste log lines above.",
      noLabelText: "no label",
      insertedText: "inside an inserted second",
      rows,
    }),
  );

describe("logTable", () => {
  it("is a named table with five named columns, and no TAI reading column", () => {
    draw([read, refused]);
    const table = screen.getByRole("table", { name: "Each log line" });
    for (const name of [
      "Line",
      "Label",
      "UTC instant",
      "TAI − UTC",
      "Message",
    ]) {
      expect(
        within(table).getByRole("columnheader", { name }),
      ).toBeInTheDocument();
    }
  });

  it("has no TAI reading column", () => {
    draw([read]);
    expect(
      screen.queryByRole("columnheader", { name: "TAI reading" }),
    ).not.toBeInTheDocument();
  });

  it("gives each row a radio named for its line, checked on the selected one", () => {
    draw([read, refused]);
    expect(screen.getByRole("radio", { name: "Read line 1" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Read line 2" }),
    ).not.toBeChecked();
  });

  it("marks the selected row as the current one", () => {
    draw([read, refused]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveAttribute("aria-current", "true");
    expect(rows[1]).not.toHaveAttribute("aria-current");
  });

  it("shows the inserted-second badge on a row inside one", () => {
    draw([read, refused]);
    expect(screen.getAllByText("inside an inserted second")).toHaveLength(1);
  });

  it("says no label in words and shows NO SIGNAL in the value cells of a refused line", () => {
    const { host } = draw([read, refused]);
    expect(screen.getByText("no label")).toBeInTheDocument();
    const table = screen.getByRole("table");
    for (const header of ["UTC instant", "TAI − UTC"]) {
      expect(cellsInColumn(table, header)[1]).toHaveTextContent(LINE_NO_SIGNAL);
      expect(cellsInColumn(table, header)[0]).not.toHaveTextContent(
        "NO SIGNAL",
      );
    }
    expect(host).toBeTruthy();
  });

  it("writes a label whole, in one piece a search for it finds", () => {
    draw([read]);
    expect(screen.getByText("@40000000586846a400000000")).toBeInTheDocument();
  });

  it("writes hostile text as text, in the label and the message", () => {
    const hostile: LogRow = {
      ...read,
      token: "</code><img/src=x/onerror=alert(1)>",
      message: "</td><img src=x onerror=alert(2)> done",
    };
    draw([hostile]);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText("</code><img/src=x/onerror=alert(1)>"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("</td><img src=x onerror=alert(2)> done"),
    ).toBeInTheDocument();
  });

  it("says so when there are no lines", () => {
    draw([]);
    expect(screen.getByText("Paste log lines above.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { host } = draw([read, refused]);
    await expectNoAxeViolations(host);
  });
});
