export type Node = {
  type: string;
  range?: [number, number];
  [key: string]: unknown;
};

export type IdentifierNode = Node & {
  type: "Identifier";
  name: string;
};

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
};

export type NewExpressionNode = Node & {
  type: "NewExpression";
  callee: Node;
};

export type ProgramNode = Node & {
  type: "Program";
};

export type ScopeReference = {
  identifier: IdentifierNode;
};

export type ScopeInfo = {
  through?: ScopeReference[];
};

export type SourceCodeLike = {
  getScope(node: Node): ScopeInfo;
};

export type RuleContext = {
  sourceCode: SourceCodeLike;
  report(input: { node: Node; message: string }): void;
};

export type RuleListener = {
  Program?: (node: ProgramNode) => void;
  NewExpression?: (node: NewExpressionNode) => void;
  CallExpression?: (node: CallExpressionNode) => void;
};

export type RuleModule = {
  meta: {
    type: "problem" | "suggestion" | "layout";
    docs: {
      description: string;
    };
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
  meta: {
    name: string;
  };
  rules: Record<string, RuleModule>;
  configs?: Record<string, OxlintPluginConfig>;
};
