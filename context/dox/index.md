# Dox: the documentation site for `@northguild/gmt`

Tiers 0 to 6 are done, the chat included; Tier 7, the domain and the hosted server, is open.
Load only what the task needs:

- [overview.md](overview.md) — architecture, decisions, tier table. Start here.
- [built.md](built.md) — what each tier ships, the rules that bind it, traps and runbooks.
  The chat (Tier 6) is its largest section.
- [tracker.md](tracker.md) — stories, GitHub issues, status.
- [specs/index.md](specs/index.md) — the execution spec of a story in progress; deleted when the story is Done.
- [reference/design-system.md](reference/design-system.md) — theme implementation rules,
  Tailwind in the chat island, the visual gate. Load when styling.
- [reference/visual-design.md](reference/visual-design.md) — the visual language. Load when
  designing UI.
- [reference/style-guide.md](reference/style-guide.md) — where a CSS rule goes, class naming,
  container queries. Load before writing or reviewing component styles.
- [reference/verification-and-risks.md](reference/verification-and-risks.md) — epic-wide
  checks and live risks. Load for reviews.
- [ui-audit.md](ui-audit.md) — open component-cleanup items. Load before restructuring
  `apps/dox/src/components/`.
