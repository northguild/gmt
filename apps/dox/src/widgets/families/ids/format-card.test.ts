// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import {
  formatCard,
  precisionLadder,
  type FormatCardOptions,
} from "./format-card";

const base: FormatCardOptions = {
  headingId: "t-int96",
  title: "Parquet INT96",
  series: 1,
  card: "int96",
  state: "read",
  stored: ["julianDay: 2459633", "nanosOfDay: 69742000000000n"],
  readBack: "2022-02-22T19:22:22Z",
  zoneless: null,
  chip: false,
  literal: "",
  validator: null,
  message: "",
  samples: {
    stored: ["nanosOfDay: 86399999999999n"],
    readBack: "-271821-04-20T00:00:00.000000001Z",
    chip: "zoneless: a wall time, not an instant",
    literal: "null",
    validator: 'isValidDateTime("x") → false',
    messages: ["A column with a zone takes an instant."],
  },
};

describe("formatCard", () => {
  it("is a region named by its heading, with what is stored and what reads back", async () => {
    const { host } = renderHtml(formatCard(base));
    const card = screen.getByRole("region", { name: "Parquet INT96" });
    expect(
      within(card).getByRole("group", { name: "Stored" }),
    ).toHaveTextContent("julianDay: 2459633");
    expect(
      within(card).getByRole("group", { name: "Reads back" }),
    ).toHaveTextContent("2022-02-22T19:22:22Z");
    await expectNoAxeViolations(host);
  });

  it("writes a refusal as a bracketed pill beside its literal", async () => {
    const { host } = renderHtml(
      formatCard({
        ...base,
        state: "sentinel",
        stored: [],
        readBack: null,
        literal: "0n",
        message: "A column with a zone takes an instant.",
      }),
    );
    const card = screen.getByRole("region", { name: "Parquet INT96" });
    expect(within(card).getByText("⟨ NO SIGNAL ⟩")).toBeInTheDocument();
    expect(within(card).getByText("0n")).toBeInTheDocument();
    expect(
      within(card).getByText("A column with a zone takes an instant."),
    ).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("keeps a zoneless row out of the tree until it has a value", () => {
    renderHtml(
      formatCard({
        ...base,
        zoneless: {
          caption: "The same int64 under a zoneless schema",
          text: null,
        },
      }),
    );
    expect(
      screen.queryByRole("group", {
        name: "The same int64 under a zoneless schema",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows the zoneless read and the chip when the card has them", () => {
    renderHtml(
      formatCard({
        ...base,
        chip: true,
        zoneless: {
          caption: "The same int64 under a zoneless schema",
          text: "2022-02-22T19:22:22",
        },
      }),
    );
    expect(
      screen.getByRole("group", {
        name: "The same int64 under a zoneless schema",
      }),
    ).toHaveTextContent("2022-02-22T19:22:22");
    expect(
      screen.getByText("zoneless: a wall time, not an instant"),
    ).toBeInTheDocument();
  });

  it("prints a validator call when it has one", () => {
    renderHtml(
      formatCard({ ...base, validator: html`isValidDateTime("x") → false` }),
    );
    expect(
      screen.getByText('isValidDateTime("x") → false'),
    ).toBeInTheDocument();
  });
});

describe("precisionLadder", () => {
  it("is a named group of four rows", async () => {
    const { host } = renderHtml(
      precisionLadder({
        label: "Precision ladder",
        sample: "-271821-04-20T00:00:00.000000001Z",
        rows: [
          { label: "exact", text: "2022-02-22T19:22:22.123456789Z" },
          { label: "INT96", text: "2022-02-22T19:22:22.123456789Z" },
          { label: "Arrow", text: "2022-02-22T19:22:22Z" },
          { label: "Timestamp", text: "" },
        ],
      }),
    );
    const ladder = screen.getByRole("group", { name: "Precision ladder" });
    expect(ladder).toHaveTextContent("Arrow");
    expect(ladder).toHaveTextContent("2022-02-22T19:22:22Z");
    expect(within(ladder).getAllByRole("code")).toHaveLength(3);
    await expectNoAxeViolations(host);
  });
});
