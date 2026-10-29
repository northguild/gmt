// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import type { Fuse, Mark } from "~/lib/gnss-rollover-checker";
import { fuseYears } from "~/lib/gnss-rollover-checker";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { FUSE_CHIP_SLOTS, fuseBoard, fuseChips, fuseKey } from "./fuse-board";

const fuse: Fuse = {
  today: 40,
  groups: [
    {
      bits: 10,
      label: "10-bit counters, weeks below 1024",
      tracks: [
        {
          counter: "GPS-LNAV",
          width: "weeks below 1024",
          born: 0,
          wraps: [{ pos: 20, state: "past" }],
          yours: true,
        },
      ],
    },
  ],
} as unknown as Fuse;

const marks: Mark[] = [
  { key: "start", label: "build date", at: "2020-01-01T00:00:00Z", pos: 10 },
  { key: "check", label: "check date", at: "2026-10-15T00:00:00Z", pos: null },
];

describe("fuseBoard", () => {
  it("is one named image whose marks are listed in words", async () => {
    const { host } = renderHtml(
      fuseBoard(
        {
          label: "Fuse timeline",
          years: fuseYears(),
          fuse,
          strip: null,
          counter: "GPS-LNAV",
        },
        ["build date: 2020-01-01T00:00:00Z"],
      ),
    );
    expect(
      screen.getByRole("img", { name: "Fuse timeline" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("names each counter's track and the width group it sits in", () => {
    renderHtml(
      fuseBoard({
        label: "Fuse timeline",
        years: fuseYears(),
        fuse,
        strip: null,
        counter: "GPS-LNAV",
      }),
    );
    expect(screen.getByText("GPS-LNAV")).toBeInTheDocument();
    expect(
      screen.getByText("10-bit counters, weeks below 1024"),
    ).toBeInTheDocument();
  });

  it("draws a skeleton of eight unnamed rows before the library has answered", () => {
    renderHtml(
      fuseBoard({
        label: "No window to draw",
        years: fuseYears(),
        fuse: null,
        strip: null,
        counter: "",
      }),
    );
    expect(
      screen.getByRole("img", { name: "No window to draw" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("GPS-LNAV")).not.toBeInTheDocument();
  });
});

describe("fuseKey", () => {
  it("is a named list that explains every part", async () => {
    const { host } = renderHtml(fuseKey({ window: true }));
    const key = screen.getByRole("list", { name: "Key to the timeline" });
    expect(within(key).getAllByRole("listitem")).toHaveLength(6);
    expect(key).toHaveTextContent("reports one counter period early");
    await expectNoAxeViolations(host);
  });
});

describe("fuseChips", () => {
  it("says each mark in words and flags one that is off the timeline", () => {
    renderHtml(fuseChips(marks));
    const list = screen.getByRole("list", { name: "Marks on the timeline" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("build date 2020-01-01T00:00:00Z");
    expect(items[1]).toHaveTextContent(
      "check date 2026-10-15T00:00:00Z (outside)",
    );
  });

  it("keeps every slot, leaving the unused ones out of the reading order", () => {
    renderHtml(fuseChips(marks));
    const list = screen.getByRole("list", { name: "Marks on the timeline" });
    expect(FUSE_CHIP_SLOTS).toBe(5);
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });
});
