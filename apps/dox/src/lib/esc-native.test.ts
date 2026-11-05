// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { setHtml } from "~/widgets/builders";
import { html } from "~/widgets/builders/html";
import { watchNativeEscLayers } from "./esc-native";

let ctl: AbortController;
beforeEach(() => {
  ctl = new AbortController();
});
afterEach(() => {
  ctl.abort();
  document.body.replaceChildren();
});

describe("native layers in the Escape order", () => {
  it("closes a licence-style details the reader is in and returns to its summary", async () => {
    const user = userEvent.setup();
    setHtml(
      document.body,
      html`<details open><summary>Licence</summary><a href="#x">Terms</a></details>`,
    );
    watchNativeEscLayers(document, ctl.signal);
    screen.getByRole("link", { name: "Terms" }).focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("group")).not.toHaveAttribute("open");
    expect(screen.getByText("Licence")).toHaveFocus();
  });

  it("leaves a details the reader is not in alone", async () => {
    const user = userEvent.setup();
    setHtml(
      document.body,
      html`<details open><summary>Licence</summary><p>Terms</p></details><button type="button">Elsewhere</button>`,
    );
    watchNativeEscLayers(document, ctl.signal);
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("group")).toHaveAttribute("open");
  });

  it("leaves the sidebar's groups alone", async () => {
    const user = userEvent.setup();
    setHtml(
      document.body,
      html`<nav><details open><summary>Guides</summary><a href="#g">Intro</a></details></nav>`,
    );
    watchNativeEscLayers(document, ctl.signal);
    screen.getByRole("link", { name: "Intro" }).focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("group")).toHaveAttribute("open");
  });

  it("picks up a details that arrives later", async () => {
    const user = userEvent.setup();
    watchNativeEscLayers(document, ctl.signal);
    setHtml(
      document.body,
      html`<details open><summary>Late</summary><a href="#x">Inside</a></details>`,
    );
    await waitFor(() => {
      screen.getByRole("link", { name: "Inside" }).focus();
    });
    await Promise.resolve();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("group")).not.toHaveAttribute("open"),
    );
  });

  it("closes an open dialog and returns focus to the search button", async () => {
    const user = userEvent.setup();
    setHtml(
      document.body,
      html`<site-search><button type="button" data-open-modal>Search</button><dialog open><input aria-label="Query" /></dialog></site-search>`,
    );
    const dialog = screen.getByRole("dialog", {
      hidden: true,
    }) as HTMLDialogElement;
    dialog.close = () => dialog.removeAttribute("open");
    watchNativeEscLayers(document, ctl.signal);
    screen.getByLabelText("Query").focus();
    await user.keyboard("{Escape}");
    expect(dialog).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
  });
});
