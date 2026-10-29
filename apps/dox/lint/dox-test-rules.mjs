/**
 * `dox-test`: oxlint JS plugin that keeps Dox widget tests on the test kit.
 *
 * Widget tests find elements by role, label and text and drive them through
 * `src/test/render-widget.ts`. The community Testing Library rules only report on code they
 * can trace to Testing Library, so these six cover the raw DOM a test reaches for by hand.
 *
 *   dox-test/no-dispatch-event  dispatchEvent, fireEvent, new Event(, new KeyboardEvent(
 *   dox-test/no-class-query     classList, className, and querySelector*, closest or matches
 *                               with a `.` or `[data-` selector
 *   dox-test/no-data-role       a string containing data-role or data-testid
 *   dox-test/no-house-class     a string containing gmt- followed by a letter
 *   dox-test/no-markup-read     innerHTML, outerHTML and toContainHTML
 *   dox-test/no-implementation-assert
 *                               toHaveClass, toHaveStyle, getComputedStyle, `.style`, and
 *                               toHaveAttribute on class, style, id or data-*
 *
 * `.mjs`, not `.ts`: a TypeScript plugin needs Node 22.18 and Dox's engines allow 22.16.
 * Loaded by `oxlint.config.mts` through `jsPlugins`; `render-widget.ts` is exempt there.
 */

const nameOf = (node) =>
  node?.type === "Identifier"
    ? node.name
    : node?.type === "Literal" && typeof node.value === "string"
      ? node.value
      : undefined;

/** The names a member expression or identifier call is known by. */
const calleeName = (callee) =>
  callee.type === "MemberExpression" ? nameOf(callee.property) : nameOf(callee);

/** The text of a string literal or template literal, or undefined. */
function textOf(node) {
  if (!node) return undefined;
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type === "TemplateLiteral")
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join("\u0000");
  return undefined;
}

/** Fires `check(text)` for every string and template literal. */
function onStrings(context, test, message) {
  // A module specifier names a file, not markup: `import … from "../data/gmt-stats"`.
  // A parent is visited before its children, so the specifier is known by then.
  const specifiers = new WeakSet();
  const skipSource = (node) => {
    if (node.source) specifiers.add(node.source);
  };
  const visit = (node) => {
    if (specifiers.has(node)) return;
    const text = textOf(node);
    if (text !== undefined && test(text)) context.report({ node, message });
  };
  return {
    ImportDeclaration: skipSource,
    ExportNamedDeclaration: skipSource,
    ExportAllDeclaration: skipSource,
    ImportExpression: skipSource,
    CallExpression(node) {
      if (MODULE_CALLS.has(calleeName(node.callee) ?? "") && node.arguments[0])
        specifiers.add(node.arguments[0]);
    },
    Literal: visit,
    TemplateLiteral: visit,
  };
}

/** `vi.mock("…")` and its kin take a module specifier as their first argument. */
const MODULE_CALLS = new Set([
  "mock",
  "doMock",
  "unmock",
  "doUnmock",
  "importActual",
  "importMock",
]);

const noDispatchEvent = {
  meta: {
    type: "problem",
    docs: {
      description: "Drive widgets with userEvent or setRange, not raw events.",
    },
    schema: [],
  },
  create(context) {
    const message =
      "Do not build or dispatch events by hand. Use the user from renderWidget() (userEvent), or setRange() for a slider.";
    return {
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (name === "dispatchEvent" || name === "fireEvent") {
          context.report({ node, message });
        }
      },
      MemberExpression(node) {
        // fireEvent.click(...): the call's callee is this member expression.
        if (nameOf(node.object) === "fireEvent")
          context.report({ node, message });
      },
      NewExpression(node) {
        const name = nameOf(node.callee);
        if (name === "Event" || name === "KeyboardEvent") {
          context.report({ node, message });
        }
      },
    };
  },
};

const SELECTOR_CALLS = new Set([
  "querySelector",
  "querySelectorAll",
  "closest",
  "matches",
]);

const noClassQuery = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Find elements by role, label or text, not by class or data attribute.",
    },
    schema: [],
  },
  create(context) {
    const message =
      "Do not query by class or data attribute. Use getByRole, getByLabelText or getByText.";
    return {
      MemberExpression(node) {
        const name = nameOf(node.property);
        if (name === "classList" || name === "className") {
          context.report({ node, message });
        }
      },
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (!SELECTOR_CALLS.has(name)) return;
        const text = textOf(node.arguments[0]);
        if (
          text !== undefined &&
          (text.includes(".") || text.includes("[data-"))
        ) {
          context.report({ node, message });
        }
      },
    };
  },
};

const noDataRole = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Do not find or assert elements through data-role or data-testid.",
    },
    schema: [],
  },
  create(context) {
    return onStrings(
      context,
      (text) => text.includes("data-role") || text.includes("data-testid"),
      "Do not rely on data-role or data-testid. Give the element a role and an accessible name and query that.",
    );
  },
};

const noHouseClass = {
  meta: {
    type: "problem",
    docs: { description: "Do not assert on the gmt- house classes." },
    schema: [],
  },
  create(context) {
    return onStrings(
      context,
      (text) => /gmt-[a-z]/i.test(text),
      "Do not name a gmt- house class in a test. Assert on role, name, text or state.",
    );
  },
};

const MARKUP_PROPS = new Set(["innerHTML", "outerHTML"]);

const noMarkupRead = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Do not read or write markup strings in a test; query what a reader perceives.",
    },
    schema: [],
  },
  create(context) {
    const message =
      "Do not read or write innerHTML, outerHTML or toContainHTML in a test. Render with renderWidget() and assert by role, name, text or state.";
    return {
      MemberExpression(node) {
        if (MARKUP_PROPS.has(nameOf(node.property) ?? ""))
          context.report({ node, message });
      },
      CallExpression(node) {
        if (calleeName(node.callee) === "toContainHTML")
          context.report({ node, message });
      },
    };
  },
};

/** Attributes a reader never perceives: styling hooks, ids and data-* state. */
const HIDDEN_ATTR = /^(class|style|id|data-)/;

const noImplementationAssert = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Assert what a person or assistive technology perceives, not classes, styles or data attributes.",
    },
    schema: [],
  },
  create(context) {
    const message =
      "Do not assert classes, styles, ids or data-* attributes. Assert role, accessible name, state, visible text, focus or keyboard behaviour; layout and colour belong to the browser gates.";
    return {
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (
          name === "toHaveClass" ||
          name === "toHaveStyle" ||
          name === "getComputedStyle"
        ) {
          context.report({ node, message });
          return;
        }
        if (name === "toHaveAttribute") {
          const attr = textOf(node.arguments[0]);
          if (attr !== undefined && HIDDEN_ATTR.test(attr))
            context.report({ node, message });
        }
      },
      MemberExpression(node) {
        if (!node.computed && nameOf(node.property) === "style")
          context.report({ node, message });
      },
    };
  },
};

export default {
  meta: { name: "dox-test" },
  rules: {
    "no-markup-read": noMarkupRead,
    "no-implementation-assert": noImplementationAssert,
    "no-dispatch-event": noDispatchEvent,
    "no-class-query": noClassQuery,
    "no-data-role": noDataRole,
    "no-house-class": noHouseClass,
  },
};
