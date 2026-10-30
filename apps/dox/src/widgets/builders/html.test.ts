// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html, raw, escapeHtml, setHtml, SafeHtml } from "./html";
import { idScope } from "./ids";
import { expectNoAxeViolations } from "~/test/render-widget";

describe("html", () => {
  it("escapes the five characters and the backtick in text", () => {
    expect(html`${`<a href="x">&'\``}`.value).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&#96;",
    );
  });

  it("escapes inside a quoted attribute so a value cannot end it", () => {
    const out = html`<i title="${'" onmouseover="x'}"></i>`.value;
    expect(out).toBe('<i title="&quot; onmouseover=&quot;x"></i>');
  });

  it("passes SafeHtml through and joins arrays", () => {
    expect(html`<b>${[html`<i>1</i>`, "<2>", 3]}</b>`.value).toBe(
      "<b><i>1</i>&lt;2&gt;3</b>",
    );
  });

  it("prints nothing for null, undefined and false, and zero as 0", () => {
    expect(html`[${null}${undefined}${false}${0}]`.value).toBe("[0]");
  });

  it("lets `${cond && html}` work for a false condition", () => {
    const on = false as boolean;
    expect(html`[${on && html`<i></i>`}]`.value).toBe("[]");
  });

  it("throws on true, in a value and inside an array, and says what to write", () => {
    // @ts-expect-error `HtmlValue` does not admit `true`.
    expect(() => html`<i hidden="${true}"></i>`).toThrow(TypeError);
    // @ts-expect-error nor does an array of them.
    expect(() => html`${[1, true]}`).toThrow(/String\(flag\)/);
    expect(html`<i hidden="${String(true)}"></i>`.value).toBe(
      '<i hidden="true"></i>',
    );
  });

  it("raw trusts its argument", () => {
    expect(raw("<path/>").value).toBe("<path/>");
    expect(escapeHtml("<")).toBe("&lt;");
  });

  it("setHtml writes SafeHtml and rejects a plain string", () => {
    const el = document.createElement("div");
    setHtml(el, html`<p>ok</p>`);
    document.body.append(el);
    expect(screen.getByText("ok")).toBeInTheDocument();
    el.remove();
    expect(() => setHtml(el, "<p>x</p>" as unknown as SafeHtml)).toThrow(
      TypeError,
    );
  });

  it("types: a bare string is not SafeHtml", () => {
    // @ts-expect-error a string is not SafeHtml
    const bad: SafeHtml = "<p>";
    expect(bad).toBe("<p>");
  });

  it("has no axe violations in what it writes", async () => {
    const el = document.createElement("div");
    document.body.append(el);
    setHtml(el, html`<p>${"<b>text</b>"}</p>`);
    await expectNoAxeViolations(el);
    el.remove();
  });
});

describe("idScope", () => {
  it("prefixes every local id with the instance prefix", () => {
    const id = idScope("w1");
    expect(id("zone")).toBe("w1-zone");
    expect(idScope("w2")("zone")).not.toBe(id("zone"));
  });
});
