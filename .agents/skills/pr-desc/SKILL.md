---
name: pr-desc
description: Look at the diff vs main and generate a PR title and description ready to copy-paste. Use when the user asks to "write a PR description", "generate a PR title", or "draft the pull request".
argument-hint: ""
---

Generate a PR title and description for the current branch by comparing it against `main`.

## Steps

1. Run `git log --oneline main..HEAD` to list commits on this branch.
2. Run `git diff main...HEAD --stat` to get a high-level file change summary.
3. Run `git diff main...HEAD -- <key files>` as needed to understand the nature of each change.
4. Group related changes into logical sections (e.g. new features, hardening, fixes, config, cleanup).

## Output format

Produce the following markdown block, ready to copy into the GitHub PR description field:

---

**Title:** `<type>(<scope>): <description> (<STORY-ID>, #<issue>)` _(e.g. `feat(domination): calendar boundaries and zone-aware buckets (CORE-5, #186)`)_ — match `git log --oneline -20`

---

## Summary

_2–4 sentence plain-English summary of what the PR does and why._

---

## What Changed

For each logical group, use this pattern:

### N. Group name

Brief one-liner describing the group.

- File or concept changed — reason/impact
- …

---

## Why

Bullet list of motivations / problems solved.

---

## Validation

- List commands run (e.g. `pnpm typecheck`, `pnpm lint`, `pnpm test`)
- State whether they passed

---

## Risk / Impact

_Low / Medium / High — and a short justification._

---

## Release

The changeset(s) in `.changeset/` and their bump level, per [coding-standards § Changesets](../../../context/coding-standards.md#changesets). Merging publishes nothing; say so if a reviewer might expect otherwise.

---

## Checklist

- [ ] Each "What Changed" section has a corresponding entry
- [ ] Type-check passed
- [ ] No secrets committed
- [ ] Changeset present with the correct bump (or none, for no behaviour change)

---

## Delivery

Output the full description in a plain fenced code block (no language tag) so it can be copied. Do not write it to a file unless the user asks for one and names the path. Never create the PR yourself — the repository owner opens every PR.

## Rules

- Keep the title under 72 characters.
- Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes: `feat`, `fix`, `chore`, `refactor`, `perf`, `docs`, `test`, `ci`.
- Do not fabricate file names — only reference files visible in the diff.
- If a section has nothing to report, omit it entirely rather than writing "N/A".
- Always wrap the final output in a plain fenced code block (` ``` ` with no language tag) so it appears as a copyable block in the chat UI.
