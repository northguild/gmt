/**
 * Element identity for the gates: the key a finding carries in its `target` field, and the CSS
 * path kept beside it as a readable `selector` for people debugging.
 *
 * The key is `scope › role "name"`, plus `[n]` only on repeats. It reads what a reader or a
 * screen reader reads (the widget, the role, the accessible name), never an id, a class, an
 * `nth-*` position or a tag name outside the role table. So a sibling insert, a React `useId`
 * change or a class rename does not move it, and the weekly sweep keeps one issue per finding.
 *
 * The name is an author-written one (`aria-label`, a label, a fieldset's legend, a table's
 * caption, a figure's figcaption, `alt`, `title`), or the text of a role that ARIA names from
 * its content (a button, a link, a heading, a header cell and the like). An element still
 * unnamed is keyed with no text at all: its widget or landmark, its role and `[n]`. Live text
 * (a month, a weekday, a zone abbreviation, a verdict) changes with the calendar, so a key
 * built from it would drift and open a new issue for the same finding. The trade-off is that
 * `[n]` counts same-role unnamed siblings, so inserting one before another shifts the keys
 * after it; that is rarer than the calendar, and a named sibling is never counted.
 *
 *   widget:gnss-week-decoder › slider "Week"
 *   contentinfo › time
 *   page
 *
 * Each export is self-contained, with no closure over module scope and no imports: a gate
 * installs one with
 * `page.addInitScript({ content: `window.__gmtIdentity = ${identityOf};` })` and jsdom tests
 * import it directly. `installIdentityScript` in the gates builds that string.
 */

/**
 * The identity key of `el`: `scope › role "name"[n]`.
 * `null`, the document and the root element are `page`.
 */
export function identityOf(el) {
  const doc = el?.ownerDocument;
  if (!el || !doc || el === doc.documentElement || el === doc.body)
    return "page";
  const win = doc.defaultView;
  const NAME_CAP = 60;
  const HEAD = 200;

  // The caches live on the window and are dropped whenever the DOM changes. The observer's
  // callback runs late, so each call also drains the pending records and checks them first.
  const fresh = () => ({
    role: new WeakMap(),
    scope: new WeakMap(),
    base: new WeakMap(),
    groups: new Map(),
  });
  let st = win.__gmtIdentityState;
  if (!st) {
    st = win.__gmtIdentityState = { ...fresh(), observer: null };
    if (win.MutationObserver) {
      st.observer = new win.MutationObserver(() =>
        Object.assign(win.__gmtIdentityState, fresh()),
      );
      st.observer.observe(doc, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }
  } else if (st.observer && st.observer.takeRecords().length > 0) {
    Object.assign(st, fresh());
  }

  const CAPTION_OF = {
    fieldset: "legend",
    table: "caption",
    figure: "figcaption",
  };
  // The roles whose name ARIA takes from their text. Every other role is named only by what an
  // author wrote for it (a label, a legend, a caption), never by text that is data.
  const NAME_FROM_CONTENT = new Set([
    "button",
    "link",
    "heading",
    "tab",
    "menuitem",
    "option",
    "checkbox",
    "radio",
    "switch",
    "treeitem",
    "columnheader",
    "rowheader",
    "term",
  ]);

  const clean = (text) => text.replace(/\s+/g, " ").trim();

  /** The first `HEAD` characters of an element's text; a big container is never read whole. */
  const head = (e) => {
    const walker = doc.createTreeWalker(e, 4 /* SHOW_TEXT */);
    let out = "";
    for (
      let n = walker.nextNode();
      n && out.length < HEAD;
      n = walker.nextNode()
    )
      out += n.nodeValue;
    return clean(out.slice(0, HEAD));
  };

  const accessibleName = (e) => {
    const labelledby = e.getAttribute("aria-labelledby");
    if (labelledby) {
      const text = clean(
        labelledby
          .split(/\s+/)
          .map((id) => {
            const target = doc.getElementById(id);
            return target ? head(target) : "";
          })
          .join(" "),
      );
      if (text) return text;
    }
    const label = e.getAttribute("aria-label");
    if (label && label.trim()) return clean(label);
    if (e.labels && e.labels.length > 0) {
      const text = clean([...e.labels].map(head).join(" "));
      if (text) return text;
    }
    // HTML-AAM: a fieldset, table and figure are named by their first legend, caption and
    // figcaption child.
    const captionTag = CAPTION_OF[e.localName];
    if (captionTag) {
      const child = [...e.children].find((c) => c.localName === captionTag);
      const text = child ? clean(head(child)) : "";
      if (text) return text;
    }
    const alt = e.getAttribute("alt");
    if (alt && alt.trim()) return clean(alt);
    const title = e.getAttribute("title");
    if (title && title.trim()) return clean(title);
    return "";
  };

  const inputRole = (e) => {
    const type = (e.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox" || type === "radio") return type;
    if (type === "range") return "slider";
    if (type === "number") return "spinbutton";
    if (type === "search") return "searchbox";
    if (["button", "submit", "reset", "image"].includes(type)) return "button";
    if (type === "hidden") return "generic";
    return "textbox";
  };

  const roleOf = (e) => {
    if (st.role.has(e)) return st.role.get(e);
    let role;
    const explicit = (e.getAttribute("role") || "").trim().split(/\s+/)[0];
    if (explicit) role = explicit;
    else {
      const tag = e.localName;
      if (tag === "a") role = e.hasAttribute("href") ? "link" : "generic";
      else if (tag === "button") role = "button";
      else if (tag === "input") role = inputRole(e);
      else if (tag === "select")
        role =
          e.multiple || Number(e.getAttribute("size")) > 1
            ? "listbox"
            : "combobox";
      else if (tag === "textarea") role = "textbox";
      else if (/^h[1-6]$/.test(tag)) role = "heading";
      else if (tag === "table") role = "table";
      else if (tag === "th")
        role = e.getAttribute("scope") === "row" ? "rowheader" : "columnheader";
      else if (tag === "td") role = "cell";
      else if (tag === "ul" || tag === "ol" || tag === "dl") role = "list";
      else if (tag === "li") role = "listitem";
      else if (tag === "section")
        role = accessibleName(e) ? "region" : "generic";
      else if (tag === "nav") role = "navigation";
      else if (tag === "main") role = "main";
      else if (tag === "aside") role = "complementary";
      else if (tag === "form") role = "form";
      else if (tag === "search") role = "search";
      else if (tag === "fieldset") role = "group";
      else if (tag === "header" || tag === "footer")
        role = e.parentElement?.closest("article, aside, main, nav, section")
          ? "generic"
          : tag === "header"
            ? "banner"
            : "contentinfo";
      else if (tag === "p") role = "paragraph";
      else if (tag === "time") role = "time";
      else if (tag === "output") role = "status";
      else if (tag === "img") role = e.hasAttribute("alt") ? "img" : "generic";
      else if (tag === "figure") role = "figure";
      else if (tag === "dt") role = "term";
      else if (tag === "dd") role = "definition";
      else role = "generic";
    }
    st.role.set(e, role);
    return role;
  };

  const NAMED_LANDMARKS = ["navigation", "complementary", "region", "form"];
  const BARE_LANDMARKS = ["banner", "main", "contentinfo", "search"];

  /** `{ root, label }`: the widget (itself included), else the nearest named landmark above. */
  const scopeOf = (e) => {
    if (st.scope.has(e)) return st.scope.get(e);
    let found = null;
    for (let a = e; a && !found; a = a.parentElement) {
      const slug = a.getAttribute("data-widget");
      if (slug) {
        found = { root: a, label: `widget:${slug}` };
        break;
      }
      if (a === e) continue;
      const role = roleOf(a);
      if (BARE_LANDMARKS.includes(role)) found = { root: a, label: role };
      else if (NAMED_LANDMARKS.includes(role)) {
        const name = accessibleName(a);
        if (name)
          found = {
            root: a,
            label: `${role} "${name.replace(/\d+/g, "#").slice(0, NAME_CAP)}"`,
          };
      }
    }
    if (!found) found = { root: doc.documentElement, label: "page" };
    st.scope.set(e, found);
    return found;
  };

  const nameOf = (e) =>
    (accessibleName(e) || (NAME_FROM_CONTENT.has(roleOf(e)) ? head(e) : ""))
      .replace(/\d+/g, "#")
      .slice(0, NAME_CAP);

  const quoted = (role, name) => (name ? `${role} "${name}"` : role);

  /** The key before `[n]`. A nameless element gains its nearest named ancestor as a step. */
  const baseOf = (e) => {
    if (st.base.has(e)) return st.base.get(e);
    const scope = scopeOf(e);
    const role = roleOf(e);
    const name = nameOf(e);
    let leaf = quoted(role, name);
    if (!name) {
      for (
        let a = e.parentElement;
        a && a !== scope.root;
        a = a.parentElement
      ) {
        const named = accessibleName(a);
        if (named) {
          leaf = `${quoted(roleOf(a), named.replace(/\d+/g, "#").slice(0, NAME_CAP))} › ${leaf}`;
          break;
        }
      }
    }
    const base = `${scope.label} › ${leaf}`;
    st.base.set(e, base);
    return base;
  };

  const rootNode = el.getRootNode();
  if (rootNode && rootNode.nodeType === 11 && rootNode.host) {
    // Shadow DOM is not pierced: stop at the host and prefix its key.
    return `${identityOf(rootNode.host)} › ${quoted(roleOf(el), nameOf(el))}`;
  }

  const base = baseOf(el);
  const role = roleOf(el);
  // One pass per role buckets every same-role element of the document by its base key. The pool
  // is the whole document, not one scope root: several widgets (14 playgrounds on a page) or
  // regions whose names differ only in digits share a scope label, and a control that is the
  // same in each must still get its own `[n]`, or the walk reads two controls as one.
  let buckets = st.groups.get(role);
  if (!buckets) {
    buckets = new Map();
    for (const candidate of doc.querySelectorAll("*")) {
      if (candidate === doc.documentElement || candidate === doc.body) continue;
      if (roleOf(candidate) !== role) continue;
      const key = baseOf(candidate);
      const list = buckets.get(key);
      if (list) list.push(candidate);
      else buckets.set(key, [candidate]);
    }
    st.groups.set(role, buckets);
  }
  const group = buckets.get(base) ?? [];
  if (group.length > 1) {
    const index = group.indexOf(el);
    if (index >= 0) return `${base}[${index + 1}]`;
  }
  return base;
}

/**
 * A readable CSS path: tag, `#id` (which ends the path) and `:nth-of-type`. It is the `selector`
 * field of a finding, for people debugging; no key reads it.
 */
export function cssPathOf(el) {
  const parts = [];
  for (
    let n = el;
    n && n.nodeType === 1 && n !== n.ownerDocument.documentElement;
    n = n.parentElement
  ) {
    let s = n.localName;
    if (n.id) {
      parts.unshift(`${s}#${CSS.escape(n.id)}`);
      break;
    }
    const same = n.parentElement
      ? [...n.parentElement.children].filter((c) => c.localName === s)
      : [];
    if (same.length > 1) s += `:nth-of-type(${same.indexOf(n) + 1})`;
    parts.unshift(s);
  }
  return parts.join(" > ");
}

/** The init-script source that defines `window.__gmtIdentity` and `window.__gmtCssPath`. */
export function identityScript() {
  return `window.__gmtIdentity = ${identityOf.toString()}; window.__gmtCssPath = ${cssPathOf.toString()};`;
}
