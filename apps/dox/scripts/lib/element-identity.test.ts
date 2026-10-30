// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cssPathOf, identityOf, identityScript } from "./element-identity.mjs";

const html = `
<header><nav aria-label="Main menu"><a href="/x">Docs</a></nav></header>
<main>
  <section data-widget="demo" role="region" aria-labelledby=":r3:">
    <h2 id=":r3:">Demo tool</h2>
    <label for=":r4:">Week 2345</label>
    <input id=":r4:" type="range" />
    <fieldset aria-label="Start"><span class="a"></span></fieldset>
    <table><tbody><tr><td></td><td></td></tr></tbody></table>
    <button class="x">Go</button>
    <button class="y">Go</button>
    <button>Stop</button>
  </section>
  <p id="outside">Plain paragraph</p>
</main>
<footer><time>Oct 29, 2026</time></footer>`;

const q = (selector: string) => document.querySelector(selector) as HTMLElement;

beforeEach(() => {
  document.body.innerHTML = html;
});

describe("identityOf", () => {
  it("scopes to the widget and reads role and accessible name", () => {
    expect(identityOf(q("input"))).toBe('widget:demo › slider "Week #"');
    expect(identityOf(q("h2"))).toBe('widget:demo › heading "Demo tool"');
    expect(identityOf(q("section"))).toBe('widget:demo › region "Demo tool"');
  });

  it("falls back to the landmark, and then to page", () => {
    expect(identityOf(q("nav a"))).toBe('navigation "Main menu" › link "Docs"');
    expect(identityOf(q("time"))).toBe("contentinfo › time");
    expect(identityOf(q("#outside"))).toBe("main › paragraph");
    expect(identityOf(document.body)).toBe("page");
    expect(identityOf(document.documentElement)).toBe("page");
  });

  it("adds [n] only on true repeats", () => {
    const buttons = [...document.querySelectorAll("button")];
    expect(identityOf(buttons[0])).toBe('widget:demo › button "Go"[1]');
    expect(identityOf(buttons[1])).toBe('widget:demo › button "Go"[2]');
    expect(identityOf(buttons[2])).toBe('widget:demo › button "Stop"');
  });

  it("indexes a repeat across widgets that share a scope label", () => {
    document.body.innerHTML = `<main>
      <div data-widget="playground"><button>Copy</button></div>
      <div data-widget="playground"><button>Copy</button></div></main>`;
    const [a, b] = [...document.querySelectorAll("button")];
    expect(identityOf(a)).toBe('widget:playground › button "Copy"[1]');
    expect(identityOf(b)).toBe('widget:playground › button "Copy"[2]');
  });

  it("gives a nameless element its nearest named ancestor", () => {
    const cells = [...document.querySelectorAll("td")];
    expect(identityOf(cells[0])).toBe("widget:demo › cell[1]");
    expect(identityOf(cells[1])).toBe("widget:demo › cell[2]");
    expect(identityOf(q("span"))).toBe('widget:demo › group "Start" › generic');
  });

  it("names a fieldset, table and figure from their legend, caption and figcaption", () => {
    document.body.innerHTML = `<main><div data-widget="w">
      <fieldset><legend>Departure 12</legend><input type="text" aria-label="t" /></fieldset>
      <table><caption>Offsets</caption><tbody><tr><td>x</td></tr></tbody></table>
      <figure><img src="a.png" /><figcaption>Chart of week 5</figcaption></figure>
      </div></main>`;
    expect(identityOf(q("fieldset"))).toBe('widget:w › group "Departure #"');
    expect(identityOf(q("table"))).toBe('widget:w › table "Offsets"');
    expect(identityOf(q("figure"))).toBe('widget:w › figure "Chart of week #"');
  });

  it("keys an unnamed element with no text, so live words cannot move it", () => {
    document.body.innerHTML = `<main><div data-widget="w">
      <time>Thu 29 Oct</time><p>Verdict: fits</p><p>Second</p></div></main>`;
    const keys = () =>
      [...document.querySelectorAll("time, p")].map(identityOf);
    const before = keys();
    expect(before).toEqual([
      "widget:w › time",
      "widget:w › paragraph[1]",
      "widget:w › paragraph[2]",
    ]);
    q("time").textContent = "Fri 30 Oct";
    q("p").textContent = "Verdict: does not fit";
    expect(keys()).toEqual(before);
  });

  it("does not move when a different sibling is inserted before", () => {
    const before = identityOf(q("input"));
    const section = q("section");
    section.insertBefore(document.createElement("aside"), section.firstChild);
    section.insertBefore(document.createElement("p"), q("label"));
    expect(identityOf(q("input"))).toBe(before);
  });

  it("does not move when every id changes and aria-labelledby is rewired (useId)", () => {
    const before = [identityOf(q("input")), identityOf(q("section"))];
    q("h2").id = ":r99:";
    q("section").setAttribute("aria-labelledby", ":r99:");
    q("label").setAttribute("for", ":r77:");
    q("input").id = ":r77:";
    expect([identityOf(q("input")), identityOf(q("section"))]).toEqual(before);
  });

  it("does not move when every class is renamed", () => {
    const before = [...document.querySelectorAll("button")].map(identityOf);
    for (const e of document.querySelectorAll("*")) e.className = "hashed_9f3a";
    expect([...document.querySelectorAll("button")].map(identityOf)).toEqual(
      before,
    );
  });

  it("collapses digit runs", () => {
    const a = identityOf(q("input"));
    q("label").textContent = "Week 2346";
    expect(identityOf(q("input"))).toBe(a);
  });

  it("cuts the name to 60 characters", () => {
    q("label").textContent = "w".repeat(200);
    const key = identityOf(q("input"));
    expect(key).toBe(`widget:demo › slider "${"w".repeat(60)}"`);
  });

  it("serialises: the function rebuilt from its source gives the same keys", () => {
    const rebuilt = new Function(`return ${identityOf.toString()}`)();
    for (const e of document.querySelectorAll("*"))
      expect(rebuilt(e)).toBe(identityOf(e));
    expect(identityScript()).toContain("window.__gmtIdentity = function");
  });

  it("reads fresh after the DOM changes", () => {
    const stop = q("button:last-of-type");
    expect(identityOf(stop)).toBe('widget:demo › button "Stop"');
    stop.textContent = "Halt";
    expect(identityOf(stop)).toBe('widget:demo › button "Halt"');
  });
});

describe("cssPathOf", () => {
  it("is a readable path that ends at an id", () => {
    expect(cssPathOf(q("#outside"))).toBe("p#outside");
    expect(cssPathOf(q("td"))).toContain("td:nth-of-type(1)");
  });
});
