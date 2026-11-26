// @vitest-environment jsdom
import { isCovered, watchCover } from "./globe-cover";

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
});

/** Starlight's search: a `<dialog>` inside `<site-search>`. */
function searchDialog(): HTMLDialogElement {
  const host = document.createElement("site-search");
  const dialog = document.createElement("dialog");
  host.append(dialog);
  document.body.append(host);
  return dialog;
}

describe("isCovered", () => {
  it("is false for a page with nothing open", () => {
    searchDialog();
    expect(isCovered(document)).toBe(false);
  });

  it("is true while the search dialog is open", () => {
    searchDialog().setAttribute("open", "");
    expect(isCovered(document)).toBe(true);
  });

  it("is true while the mobile menu is expanded", () => {
    document.body.setAttribute("data-mobile-menu-expanded", "");
    expect(isCovered(document)).toBe(true);
  });

  it("ignores a dialog that is not the search", () => {
    const other = document.createElement("dialog");
    other.setAttribute("open", "");
    document.body.append(other);
    expect(isCovered(document)).toBe(false);
  });
});

describe("watchCover", () => {
  it("reports when the search dialog opens and closes", async () => {
    const dialog = searchDialog();
    const seen: boolean[] = [];
    stop = watchCover(document, (covered) => seen.push(covered));
    dialog.setAttribute("open", "");
    await vi.waitFor(() => expect(seen).toEqual([true]));
    dialog.removeAttribute("open");
    await vi.waitFor(() => expect(seen).toEqual([true, false]));
  });

  it("reports when the mobile menu opens and closes", async () => {
    const seen: boolean[] = [];
    stop = watchCover(document, (covered) => seen.push(covered));
    document.body.setAttribute("data-mobile-menu-expanded", "");
    await vi.waitFor(() => expect(seen).toEqual([true]));
    document.body.removeAttribute("data-mobile-menu-expanded");
    await vi.waitFor(() => expect(seen).toEqual([true, false]));
  });

  it("stays covered until both are closed, and says so once", async () => {
    const dialog = searchDialog();
    const seen: boolean[] = [];
    stop = watchCover(document, (covered) => seen.push(covered));
    dialog.setAttribute("open", "");
    document.body.setAttribute("data-mobile-menu-expanded", "");
    await vi.waitFor(() => expect(seen).toEqual([true]));
    dialog.removeAttribute("open");
    await Promise.resolve();
    expect(seen).toEqual([true]);
    document.body.removeAttribute("data-mobile-menu-expanded");
    await vi.waitFor(() => expect(seen).toEqual([true, false]));
  });

  it("reports at once when the page is already covered", () => {
    searchDialog().setAttribute("open", "");
    const seen: boolean[] = [];
    stop = watchCover(document, (covered) => seen.push(covered));
    expect(seen).toEqual([true]);
  });

  it("stops reporting after it is stopped", async () => {
    const dialog = searchDialog();
    const seen: boolean[] = [];
    stop = watchCover(document, (covered) => seen.push(covered));
    stop();
    dialog.setAttribute("open", "");
    await Promise.resolve();
    expect(seen).toEqual([]);
  });
});
