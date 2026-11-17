# Dox: the documentation site for `@northguild/gmt`

Load only what the task needs:

- [overview.md](overview.md) — architecture, decisions, tier table. Start here.
- [built/](built/index.md) — what each tier ships, the rules that bind it, traps and runbooks.
  The chat (Tier 6) is its largest section.
- [reference-export.md](reference-export.md) — the command another repo runs to get the
  reference corpus, and the format of the files it writes.
- [tracker.md](tracker.md) — stories, GitHub issues, status.
- [cloudflare-runbook.md](cloudflare-runbook.md) — zone settings, API tokens, deploy checks and
  search-engine setup for `northguild.dev`. Load for a deploy, a zone audit or a 403 from a crawler.
- [specs/index.md](specs/index.md) — the execution spec of a story in progress; deleted when the story is Done, with any rule the code cannot show moved into `built/`.
- [reference/design-system.md](reference/design-system.md) — theme implementation rules: stylesheet
  stack, tokens, maintenance rules, the visual gate. Load when styling. Scoped companions, loaded
  only for that surface: [widgets](reference/design-system-widgets.md) (controls, smooth growth),
  [charts](reference/design-system-charts.md), [motion and header](reference/design-system-motion.md),
  [chat island](reference/design-system-chat.md).
- [reference/visual-design.md](reference/visual-design.md) — the visual language. Load when
  designing UI.
- [reference/style-guide.md](reference/style-guide.md) — where a CSS rule goes, class naming,
  container queries. Load before writing or reviewing component styles.
- [reference/verification-and-risks.md](reference/verification-and-risks.md) — epic-wide
  checks and live risks. Load for reviews.
- [ui-audit.md](ui-audit.md) — open component-cleanup items. Load before restructuring
  `apps/dox/src/components/`.
