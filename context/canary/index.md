# Canary: the scheduled checks that watch what GMT depends on

A canary is a scheduled job that checks something GMT does not control: the engines it runs on,
the polyfill it ships, the data tables it carries. It never fails a pull request. It reports
through GitHub issues. Load only what the task needs:

- [overview.md](overview.md) — every canary, what it checks and files, the rules they share, and
  which engine covers which browser. **Start here.**
- [tracker.md](tracker.md) — the `CNRY-*` stories and the earlier canary stories, with status.
- [issues/](issues/) — one file per `CNRY-*` story, named by story ID.

Story IDs for canary work are `CNRY-<n>`. The canary stories built before this epic keep their
`CORE-*` IDs and their records in [../domination/issues/](../domination/issues/); the tracker
lists them.
