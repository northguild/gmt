import type { StarlightRouteData } from "@astrojs/starlight/route-data";
import { DIVIDER_ATTR, leanSidebar, skipDividers } from "./lean-sidebar";

type Entry = StarlightRouteData["sidebar"][number];
type Link = Extract<Entry, { type: "link" }>;
type Group = Extract<Entry, { type: "group" }>;

const link = (href: string, label = href, extra: Partial<Link> = {}): Link => ({
  type: "link",
  label,
  href,
  isCurrent: false,
  badge: undefined,
  attrs: {},
  ...extra,
});

const group = (
  label: string,
  entries: Entry[],
  extra: Partial<Group> = {},
): Group => ({
  type: "group",
  label,
  entries,
  collapsed: false,
  badge: undefined,
  ...extra,
});

const divider = (): Link =>
  link("/gmt/reference/#by-industry", "By industry", {
    attrs: { [DIVIDER_ATTR]: "true" },
  });

/** A namespace group: Overview, one module group and two functions. */
const namespace = (name: string, overviewAttrs = {}): Group =>
  group(name, [
    link(`/gmt/reference/${name}/`, "Overview", { attrs: overviewAttrs }),
    group("calculate", [
      link(`/gmt/reference/${name}/calculate/a/`, "a"),
      link(`/gmt/reference/${name}/calculate/b/`, "b"),
    ]),
  ]);

const tree = (): Entry[] => [
  group("Guides", [link("/gmt/guides/one/", "One")]),
  group("API Reference", [
    link("/gmt/reference/", "Overview"),
    namespace("calendar"),
    namespace("plain"),
    group("types", [
      link("/gmt/reference/types/", "Overview"),
      link("/gmt/reference/types/Foo/", "Foo"),
    ]),
    divider(),
    namespace("workforce", { "data-icon": "workforce" }),
  ]),
  group("Tools", [link("/gmt/tools/x/", "X")]),
];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

const reference = (sidebar: Entry[]): Group => sidebar[1] as Group;
const childGroup = (sidebar: Entry[], label: string): Group =>
  reference(sidebar).entries.find(
    (e): e is Group => e.type === "group" && e.label === label,
  ) as Group;

describe("leanSidebar", () => {
  it("keeps the current namespace whole", () => {
    const out = leanSidebar(tree(), "reference/plain/calculate/a");
    expect(childGroup(out, "plain")).toEqual(childGroup(tree(), "plain"));
  });

  it("reduces every other namespace to a collapsed group of its Overview", () => {
    const out = leanSidebar(tree(), "reference/plain/calculate/a");
    for (const name of ["calendar", "types", "workforce"]) {
      const g = childGroup(out, name);
      expect(g.collapsed).toBe(true);
      expect(g.entries).toEqual([childGroup(tree(), name).entries[0]]);
    }
  });

  it("keeps the label and badge of a reduced group", () => {
    const input = tree();
    (reference(input).entries[1] as Group).badge = {
      text: "new",
      variant: "tip",
    } as Group["badge"];
    const g = childGroup(leanSidebar(input, "guides/one"), "calendar");
    expect(g.label).toBe("calendar");
    expect(g.badge).toEqual({ text: "new", variant: "tip" });
  });

  it("keeps the Overview link's attrs, so an icon rule on it still matches", () => {
    const g = childGroup(leanSidebar(tree(), "guides/one"), "workforce");
    expect((g.entries[0] as Link).attrs).toEqual({ "data-icon": "workforce" });
  });

  it("reads the namespace of types pages", () => {
    const out = leanSidebar(tree(), "reference/types/Foo");
    expect(childGroup(out, "types").entries).toHaveLength(2);
    expect(childGroup(out, "plain").entries).toHaveLength(1);
  });

  it("reduces every namespace on the reference index and on pages outside reference", () => {
    for (const id of ["reference", "guides/one", "", "tools/x"]) {
      const out = leanSidebar(tree(), id);
      for (const name of ["calendar", "plain", "types", "workforce"])
        expect(childGroup(out, name).entries).toHaveLength(1);
    }
  });

  it("keeps the dividers, the top Overview and the groups outside API Reference", () => {
    const input = tree();
    const out = leanSidebar(input, "guides/one");
    expect(out[0]).toEqual(input[0]);
    expect(out[2]).toEqual(input[2]);
    const entries = reference(out).entries;
    expect(entries[0]).toEqual(link("/gmt/reference/", "Overview"));
    expect(
      entries.filter((e) => e.type === "link" && e.attrs[DIVIDER_ATTR]),
    ).toHaveLength(1);
    expect(entries).toHaveLength(reference(input).entries.length);
  });

  it("finds API Reference by its first link, not its label", () => {
    const input = tree();
    reference(input).label = "Reference";
    const out = leanSidebar(input, "guides/one");
    expect(childGroup(out, "plain").entries).toHaveLength(1);
  });

  it("returns a new array and never mutates its input", () => {
    const input = deepFreeze(tree());
    const out = leanSidebar(input, "reference/plain/calculate/a");
    expect(out).not.toBe(input);
    expect(input).toEqual(tree());
  });
});

describe("skipDividers", () => {
  // calendar ... plain, divider, workforce
  const flat = (current: string): Entry[] => [
    group("API Reference", [
      link("/gmt/reference/", "Overview"),
      link("/gmt/reference/plain/z/", "plain z", {
        isCurrent: current === "plain",
      }),
      divider(),
      link("/gmt/reference/workforce/", "workforce", {
        isCurrent: current === "workforce",
      }),
      link("/gmt/reference/workforce/y/", "workforce y"),
    ]),
  ];

  it("moves next off the divider to the page after it", () => {
    const sidebar = flat("plain");
    const out = skipDividers(sidebar, {
      prev: link("/gmt/reference/"),
      next: divider(),
    });
    expect(out.prev?.href).toBe("/gmt/reference/");
    expect(out.next?.href).toBe("/gmt/reference/workforce/");
  });

  it("moves prev off the divider to the page before it", () => {
    const out = skipDividers(flat("workforce"), {
      prev: divider(),
      next: link("/gmt/reference/workforce/y/"),
    });
    expect(out.prev?.href).toBe("/gmt/reference/plain/z/");
    expect(out.next?.href).toBe("/gmt/reference/workforce/y/");
  });

  it("leaves pagination that does not touch a divider as it was", () => {
    const pagination = {
      prev: link("/gmt/a/"),
      next: link("/gmt/b/"),
    };
    expect(skipDividers(flat("plain"), pagination)).toEqual(pagination);
  });

  it("gives the same neighbours as the full tree after the trim", () => {
    const full = flat("workforce");
    const out = skipDividers(full, { prev: divider(), next: undefined });
    expect(out.prev?.href).toBe("/gmt/reference/plain/z/");
    expect(out.next).toBeUndefined();
  });
});
