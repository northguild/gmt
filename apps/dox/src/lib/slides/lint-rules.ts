import plugin, { recommendedConfig } from "@northguild/gmt-oxlint";

/**
 * `@northguild/gmt-oxlint`'s rules, read from the plugin when the page is built: the order its
 * recommended config lists them, each with the description the rule itself carries. The plugin is
 * loaded from its `dist`, so `@northguild/gmt-oxlint` is built before Dox (`build:gmt-oxlint` in
 * `scripts/lib/affected.mjs`).
 */
export const LINT_RULES: readonly { rule: string; description: string }[] =
  Object.keys(recommendedConfig.rules).map((key) => {
    const rule = key.slice(`${plugin.meta.name}/`.length);
    return { rule, description: plugin.rules[rule]!.meta.docs.description };
  });
