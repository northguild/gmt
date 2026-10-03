/**
 * Which public functions use which public types.
 *
 * Built from type **nodes**, resolved with the checker, never from printed signatures: the
 * printer inlines a union alias, so `overflow?: Overflow` prints as
 * `"constrain" | "reject"` and a text match never sees `Overflow`.
 *
 * Pure: it takes the checker and the public declarations and writes nothing. The graph
 * decides where a type is documented. A type two or more public functions reach gets its
 * own page; a type one function reaches is documented on that function's page; a type no
 * function reaches is an orphan, which the caller reports.
 */

import GithubSlugger from "github-slugger";
import ts from "typescript";

export interface TypeUsage {
  /** Every public type, by name. */
  types: Map<string, TypeNode>;
  /** Per public function (key: `${ns}/${mod}/${name}`): types named directly, in source order. */
  direct: Map<string, string[]>;
  /** Per public function: transitive closure of `direct`, depth-first in source order. */
  reach: Map<string, string[]>;
  /** Types reached by no public function. */
  orphans: string[];
}

export interface TypeNode {
  name: string;
  /** Public functions that reach it, directly or through another type. */
  usedBy: string[];
  /** Reached from at least one parameter (an input type). False: return-only. */
  input: boolean;
  placement:
    | { kind: "page" }
    | { kind: "inline"; owner: /* function key */ string; anchor: string };
}

/** A public function: a declaration, or a `const` initialised with an arrow or function. */
export interface PublicFunctionDecl {
  /** `${ns}/${mod}/${name}`. */
  key: string;
  node: ts.FunctionDeclaration | ts.VariableDeclaration;
}

/** A public type alias or interface. */
export interface PublicTypeDecl {
  name: string;
  node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration;
}

/** Public type declarations by node, the lookup `typeReferences` resolves against. */
export type PublicTypeIndex = ReadonlyMap<ts.Node, string>;

export function publicTypeIndex(
  types: readonly PublicTypeDecl[],
): PublicTypeIndex {
  return new Map(types.map((t) => [t.node as ts.Node, t.name]));
}

/**
 * The public types `node` names, in source order, each once. Resolves every
 * `TypeReferenceNode` and every `extends` clause through the checker, following an import
 * alias to the declaration it names.
 */
export function typeReferences(
  checker: ts.TypeChecker,
  node: ts.Node | undefined,
  index: PublicTypeIndex,
): string[] {
  const found: string[] = [];
  const visit = (n: ts.Node): void => {
    const named = ts.isTypeReferenceNode(n)
      ? n.typeName
      : ts.isExpressionWithTypeArguments(n)
        ? n.expression
        : undefined;
    if (named) {
      const name = resolvePublicType(checker, named, index);
      if (name !== undefined && !found.includes(name)) found.push(name);
    }
    ts.forEachChild(n, visit);
  };
  if (node) visit(node);
  return found;
}

/**
 * The public type a type name refers to (the `typeName` of a reference, the expression of
 * an `extends` clause), or undefined when it names anything else: a Temporal or lib type, a
 * type parameter, a utility type.
 */
export function resolvePublicType(
  checker: ts.TypeChecker,
  named: ts.Node,
  index: PublicTypeIndex,
): string | undefined {
  let symbol = checker.getSymbolAtLocation(named);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    symbol = checker.getAliasedSymbol(symbol);
  }
  for (const declaration of symbol?.declarations ?? []) {
    const name = index.get(declaration);
    if (name !== undefined) return name;
  }
  return undefined;
}

interface FunctionShape {
  /** The annotation of each parameter that has one. */
  params: ts.TypeNode[];
  returns: ts.TypeNode | undefined;
  generic: boolean;
}

/** The parameter and return annotations of a public function, however it is declared. */
function functionShape(node: PublicFunctionDecl["node"]): FunctionShape {
  const of = (fn: ts.SignatureDeclarationBase): FunctionShape => ({
    params: fn.parameters.flatMap((p) => (p.type ? [p.type] : [])),
    returns: fn.type,
    generic: (fn.typeParameters?.length ?? 0) > 0,
  });
  if (ts.isFunctionDeclaration(node)) return of(node);
  // `const f: (a: string) => string = …` annotates on the variable.
  if (node.type && ts.isFunctionTypeNode(node.type)) return of(node.type);
  const init = node.initializer;
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
    return of(init);
  }
  return { params: [], returns: undefined, generic: false };
}

function listed(names: readonly string[]): string {
  return [...names].sort().join(", ");
}

/**
 * Build the usage graph.
 *
 * Throws, with one aggregated message each, on: two public types sharing a name, also when
 * the names differ only by case (they would share one page or one anchor); a public function
 * with no return annotation (an inferred return names no type to walk); and an overloaded or
 * generic public function (one page cannot say which signature a type belongs to).
 */
export function buildTypeUsage(
  checker: ts.TypeChecker,
  functions: readonly PublicFunctionDecl[],
  types: readonly PublicTypeDecl[],
): TypeUsage {
  // One type per symbol: a merged interface has several declarations and is still one type.
  const symbolOf = (t: PublicTypeDecl) =>
    checker.getSymbolAtLocation(t.node.name);
  const byName = new Map<string, PublicTypeDecl[]>();
  const firstSymbol = new Map<string, ts.Symbol | undefined>();
  const duplicates = new Set<string>();
  for (const t of types) {
    const known = byName.get(t.name);
    if (!known) {
      byName.set(t.name, [t]);
      firstSymbol.set(t.name, symbolOf(t));
    } else if (firstSymbol.get(t.name) === symbolOf(t)) {
      known.push(t);
    } else {
      duplicates.add(t.name);
    }
  }
  const folded = new Map<string, string>();
  for (const name of byName.keys()) {
    const clash = folded.get(name.toLowerCase());
    if (clash !== undefined) duplicates.add(`${clash} / ${name}`);
    else folded.set(name.toLowerCase(), name);
  }
  if (duplicates.size > 0) {
    throw new Error(
      `[reference] public type names must be unique, ignoring case: ${listed([...duplicates])}. Rename one of each pair in packages/gmt/src.`,
    );
  }

  const seenKeys = new Set<string>();
  const overloaded = new Set<string>();
  const unannotated: string[] = [];
  const shapes = new Map<string, FunctionShape>();
  for (const fn of functions) {
    const shape = functionShape(fn.node);
    const bodiless = ts.isFunctionDeclaration(fn.node) && !fn.node.body;
    if (seenKeys.has(fn.key) || bodiless || shape.generic) {
      overloaded.add(fn.key);
      continue;
    }
    seenKeys.add(fn.key);
    if (!shape.returns) unannotated.push(fn.key);
    shapes.set(fn.key, shape);
  }
  if (unannotated.length > 0) {
    throw new Error(
      `[reference] public functions must annotate their return type: ${listed(unannotated)}.`,
    );
  }
  if (overloaded.size > 0) {
    throw new Error(
      `[reference] public functions must not be overloaded or generic: ${listed([...overloaded])}.`,
    );
  }

  const index = publicTypeIndex(types);

  // Type-to-type edges, from each type's own declaration.
  const edges = new Map<string, string[]>();
  for (const [name, decls] of byName) {
    const out: string[] = [];
    for (const d of decls) {
      for (const ref of typeReferences(checker, d.node, index)) {
        if (ref !== name && !out.includes(ref)) out.push(ref);
      }
    }
    edges.set(name, out);
  }

  /** `roots`, then everything they reach, depth-first in source order, each once. */
  const closure = (roots: readonly string[]): string[] => {
    const out: string[] = [];
    const visit = (name: string): void => {
      if (out.includes(name)) return;
      out.push(name);
      for (const next of edges.get(name) ?? []) visit(next);
    };
    for (const root of roots) visit(root);
    return out;
  };

  const nodes = new Map<string, TypeNode>();
  for (const name of byName.keys()) {
    nodes.set(name, {
      name,
      usedBy: [],
      input: false,
      placement: { kind: "page" },
    });
  }

  const direct = new Map<string, string[]>();
  const reach = new Map<string, string[]>();
  for (const [key, shape] of shapes) {
    const fromParams: string[] = [];
    for (const param of shape.params) {
      for (const ref of typeReferences(checker, param, index)) {
        if (!fromParams.includes(ref)) fromParams.push(ref);
      }
    }
    const fromReturn = typeReferences(checker, shape.returns, index);
    const named = [...fromParams];
    for (const ref of fromReturn) if (!named.includes(ref)) named.push(ref);

    direct.set(key, named);
    // Parameter types first, so an input type's own members come before any return type.
    const reached = closure(named);
    reach.set(key, reached);
    for (const name of reached) nodes.get(name)!.usedBy.push(key);
    for (const name of closure(fromParams)) nodes.get(name)!.input = true;
  }

  const orphans: string[] = [];
  for (const [key, reached] of reach) {
    for (const name of reached) {
      const node = nodes.get(name)!;
      if (node.usedBy.length !== 1) continue;
      node.placement = { kind: "inline", owner: key, anchor: "" };
    }
  }
  for (const node of nodes.values()) {
    if (node.usedBy.length === 0) orphans.push(node.name);
  }

  const usage: TypeUsage = { types: nodes, direct, reach, orphans };
  // The anchors of a page that holds nothing but its inline types. A caller that knows the
  // page's other headings calls `assignInlineAnchors` again with all of them.
  assignInlineAnchors(usage, (_key, inline) => ({ headings: inline, at: 0 }));
  return usage;
}

/** The types documented on a function's own page, in the order the page lists them. */
export function inlineTypesOf(usage: TypeUsage, key: string): string[] {
  return (usage.reach.get(key) ?? []).filter((name) => {
    const placement = usage.types.get(name)?.placement;
    return placement?.kind === "inline" && placement.owner === key;
  });
}

/**
 * The anchor of each heading of one page, as Starlight assigns them: `github-slugger`, one
 * slugger per page, fed every heading in order, so a heading that repeats an earlier one
 * gets a numbered suffix (`options`, then `options-1`).
 */
export function headingAnchors(headings: readonly string[]): string[] {
  const slugger = new GithubSlugger();
  return headings.map((heading) => slugger.slug(heading));
}

/** Every heading of a page, in order, and where its inline types are documented. */
export interface PageHeadings {
  headings: readonly string[];
  /**
   * The index in `headings` of the first inline type that has a heading of its own. The
   * rest follow it, in order.
   */
  at: number;
  /**
   * Inline types that have no heading: each is the type of an expanded parameter, and its
   * Options block documents it under an element that carries its anchor.
   */
  inOptions?: readonly string[];
}

/**
 * The anchors of a page: one per heading, as `headingAnchors` gives them, then one per
 * extra name. The extras are anchors the page sets by hand, on an element that is not a
 * heading. They come from the same slugger, after every heading, so none can repeat a
 * heading's id or another extra's.
 */
export function pageAnchors(
  headings: readonly string[],
  extras: readonly string[] = [],
): { headings: string[]; extras: string[] } {
  const all = headingAnchors([...headings, ...extras]);
  return {
    headings: all.slice(0, headings.length),
    extras: all.slice(headings.length),
  };
}

/**
 * Set the anchor of every inline type from the headings of the page that holds it.
 *
 * `headingsOf` returns every heading the owner's page emits, in order, given the inline
 * types it holds, and where their own headings start. A type named like a section
 * (`Options`) then gets the suffix the page will really give it (`options-1`), instead of an
 * anchor that lands on the section.
 *
 * An inline type the page documents in an Options block (`inOptions`) has no heading. Its
 * anchor is slugged after every heading, so it never takes an id a heading has.
 *
 * Throws when a page does not head its inline types, in order, where it says it does, or
 * when two of them would share an anchor: a link to either would land on the wrong place.
 */
export function assignInlineAnchors(
  usage: TypeUsage,
  headingsOf: (key: string, inline: readonly string[]) => PageHeadings,
): void {
  const problems: string[] = [];
  for (const key of usage.reach.keys()) {
    const inline = inlineTypesOf(usage, key);
    if (inline.length === 0) continue;
    const { headings, at, inOptions = [] } = headingsOf(key, inline);
    const anchors = pageAnchors(headings, inOptions);
    const taken = new Map<string, string>();
    let headed = 0;
    for (const name of inline) {
      let anchor: string;
      const held = inOptions.indexOf(name);
      if (held >= 0) {
        anchor = anchors.extras[held];
      } else {
        const index = at + headed++;
        if (headings[index] !== name) {
          problems.push(
            `${key}: heading ${index} is ${JSON.stringify(headings[index])}, not ${name}`,
          );
          continue;
        }
        anchor = anchors.headings[index];
      }
      const clash = taken.get(anchor);
      if (clash !== undefined) {
        problems.push(`${key}: ${clash} and ${name} share #${anchor}`);
        continue;
      }
      taken.set(anchor, name);
      usage.types.get(name)!.placement = { kind: "inline", owner: key, anchor };
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `[reference] inline types need one anchor each on their function's page: ${problems.join("; ")}.`,
    );
  }
}
