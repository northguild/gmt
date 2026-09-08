export type Node = {
  type: string;
  range?: [number, number];
  [key: string]: unknown;
};

export type IdentifierNode = Node & { type: "Identifier"; name: string };

export type MemberExpressionNode = Node & {
  type: "MemberExpression";
  object: Node;
  property: Node;
  computed?: boolean;
};

export type ChainExpressionNode = Node & {
  type: "ChainExpression";
  expression: Node;
};

export type CallExpressionNode = Node & {
  type: "CallExpression";
  callee: Node;
  arguments?: Node[];
};

export type LiteralNode = Node & { type: "Literal"; value?: unknown };

export type ImportDeclarationNode = Node & {
  type: "ImportDeclaration";
  source: LiteralNode;
};

/** `import("date-fns")` — the specifier can be any expression, not just a literal. */
export type ImportExpressionNode = Node & {
  type: "ImportExpression";
  source: Node;
};

/** `source` is null for `export { x }` with no `from` clause. */
export type ExportFromNode = Node & {
  type: "ExportNamedDeclaration" | "ExportAllDeclaration";
  source?: LiteralNode | null;
};

export type NewExpressionNode = Node & { type: "NewExpression"; callee: Node };

export type ProgramNode = Node & { type: "Program" };

export type ScopeReference = { identifier: IdentifierNode };

export type ScopeInfo = { through?: ScopeReference[] };

export type SourceCodeLike = { getScope(node: Node): ScopeInfo };

export type RuleContext = {
  sourceCode: SourceCodeLike;
  report(input: { node: Node; message: string }): void;
};

export type RuleListener = {
  Program?: (node: ProgramNode) => void;
  NewExpression?: (node: NewExpressionNode) => void;
  CallExpression?: (node: CallExpressionNode) => void;
  ImportDeclaration?: (node: ImportDeclarationNode) => void;
  ImportExpression?: (node: ImportExpressionNode) => void;
  ExportNamedDeclaration?: (node: ExportFromNode) => void;
  ExportAllDeclaration?: (node: ExportFromNode) => void;
};

export type RuleModule = {
  meta: {
    type: "problem" | "suggestion" | "layout";
    docs: { description: string };
    schema: unknown[];
  };
  create(context: RuleContext): RuleListener;
};

export type OxlintPluginRuleConfig =
  | "error"
  | "warn"
  | "off"
  | readonly [string]
  | readonly [string, unknown];

export interface OxlintPluginConfig {
  rules?: Record<string, OxlintPluginRuleConfig>;
}

export type OxlintPlugin = {
  meta: { name: string };
  rules: Record<string, RuleModule>;
  configs?: Record<string, OxlintPluginConfig>;
};
