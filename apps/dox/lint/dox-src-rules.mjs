/**
 * `dox-src`: oxlint JS plugin that keeps Dox mounts and widget code on the component kit.
 *
 *   dox-src/no-hand-markup      a string or template literal that contains `<section`,
 *                               `role="slider"`, `<output`, `type="range"`, `type="checkbox"`,
 *                               `type="radio"` or `class="gmt-` outside `src/widgets/**` and test files
 *   dox-src/no-nth-selector     `:nth-` in a string
 *   dox-src/no-module-counter   a top-level `let` that is assigned a number in a `*-mount.ts`
 *   dox-src/no-define-at-top    `customElements.define` outside a function
 *
 * `.mjs`, not `.ts`: a TypeScript plugin needs Node 22.18 and Dox's engines allow 22.16.
 * Loaded by `oxlint.config.mts` through `jsPlugins`, scoped to `src/lib/**` and
 * `src/widgets/**`. Mounts that still break a rule are on `lint/legacy-src-files.mjs`.
 */

/** The text of a string literal or template literal, or undefined. */
function textOf(node) {
  if (!node) return undefined;
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type === "TemplateLiteral")
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join("\u0000");
  return undefined;
}

/** Fires `test(text)` for every string and template literal; reports when it is true. */
function onStrings(context, test, message) {
  const visit = (node) => {
    const text = textOf(node);
    if (text !== undefined && test(text)) context.report({ node, message });
  };
  return { Literal: visit, TemplateLiteral: visit };
}

const HAND_MARKUP = [
  "<section",
  'role="slider"',
  "<output",
  'type="range"',
  'type="checkbox"',
  'type="radio"',
  'class="gmt-',
];

/** The path oxlint is linting, in either `context.filename` or the older `getFilename()`. */
const filenameOf = (context) =>
  String(context.filename ?? context.getFilename?.() ?? "").replaceAll(
    "\\",
    "/",
  );

const noHandMarkup = {
  meta: {
    type: "problem",
    docs: {
      description: "Build widget markup with the component kit, not strings.",
    },
    schema: [],
  },
  create(context) {
    const file = filenameOf(context);
    // Widgets build markup; tests hold markup fixtures to feed it.
    if (file.includes("/src/widgets/") || /\.test\.tsx?$/.test(file)) return {};
    return onStrings(
      context,
      (text) => HAND_MARKUP.some((needle) => text.includes(needle)),
      "Do not write widget markup by hand. Use a component from src/widgets/ (a section, slider, output or toggle).",
    );
  },
};

const noNthSelector = {
  meta: {
    type: "problem",
    docs: { description: "Select by class or attribute, never by position." },
    schema: [],
  },
  create(context) {
    return onStrings(
      context,
      (text) => text.includes(":nth-"),
      "Do not select by position (:nth-*). Give the element a class or attribute.",
    );
  },
};

const noModuleCounter = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A mount keeps its counters on the instance, not at module level.",
    },
    schema: [],
  },
  create(context) {
    if (!filenameOf(context).endsWith("-mount.ts")) return {};
    const counters = new Map();
    return {
      VariableDeclaration(node) {
        if (node.kind !== "let" || node.parent?.type !== "Program") return;
        for (const decl of node.declarations) {
          if (decl.id?.type === "Identifier")
            counters.set(decl.id.name, {
              decl,
              numeric:
                decl.init?.type === "Literal" &&
                typeof decl.init.value === "number",
            });
        }
      },
      AssignmentExpression(node) {
        if (node.left?.type !== "Identifier") return;
        const entry = counters.get(node.left.name);
        if (
          entry &&
          node.right?.type === "Literal" &&
          typeof node.right.value === "number"
        )
          entry.numeric = true;
        if (entry && node.operator !== "=" && node.operator !== "??=")
          entry.numeric = true;
      },
      UpdateExpression(node) {
        if (node.argument?.type !== "Identifier") return;
        const entry = counters.get(node.argument.name);
        if (entry) entry.numeric = true;
      },
      "Program:exit"() {
        for (const { decl, numeric } of counters.values()) {
          if (numeric) {
            context.report({
              node: decl,
              message:
                "A mount must not keep a module-level counter. Keep the count on the mounted instance so two mounts do not share it.",
            });
          }
        }
      },
    };
  },
};

const noDefineAtTop = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Register a custom element from a function, not at import time.",
    },
    schema: [],
  },
  create(context) {
    let depth = 0;
    const enter = () => {
      depth += 1;
    };
    const leave = () => {
      depth -= 1;
    };
    return {
      FunctionDeclaration: enter,
      "FunctionDeclaration:exit": leave,
      FunctionExpression: enter,
      "FunctionExpression:exit": leave,
      ArrowFunctionExpression: enter,
      "ArrowFunctionExpression:exit": leave,
      CallExpression(node) {
        const callee = node.callee;
        if (
          depth === 0 &&
          callee?.type === "MemberExpression" &&
          callee.object?.type === "Identifier" &&
          callee.object.name === "customElements" &&
          callee.property?.name === "define"
        ) {
          context.report({
            node,
            message:
              "Do not call customElements.define at import time. Call it from a function the mount runs.",
          });
        }
      },
    };
  },
};

export default {
  meta: { name: "dox-src" },
  rules: {
    "no-hand-markup": noHandMarkup,
    "no-nth-selector": noNthSelector,
    "no-module-counter": noModuleCounter,
    "no-define-at-top": noDefineAtTop,
  },
};
