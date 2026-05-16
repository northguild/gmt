---
name: commit-message
description: Look at unstaged and staged changes since the last commit and produce a ready-to-copy git commit message. Does not run any git commands — output only.
argument-hint: "no arguments needed"
---

# Generate Commit Message

Produce a commit message for the changes that have accumulated since the last commit. **Do not run `git commit` or any destructive git command.** Output the message as a copyable code block and stop.

## Steps

### 1. Understand what changed

Run these in parallel:

```bash
git diff HEAD          # unstaged changes
git diff --cached      # staged changes
git status --short     # overall picture
```

Read enough of the diff to understand the *nature* of each change — new feature, bug fix, refactor, config, docs, test, chore. If a file path isn't enough context, read a key hunk or two.

### 2. Check recent commit style

```bash
git log --oneline -10
```

Study the subject-line style: casing, verb tense, prefix conventions (if any), typical length. Match it exactly. This repo uses short imperative subject lines with no conventional-commit prefix (e.g. `Add relative formatters`, not `feat: add relative formatters`).

### 3. Draft the message

**Subject line rules:**
- Imperative mood, present tense: "Add X", "Fix Y", "Update Z"
- No trailing period
- 72 characters or fewer
- Describes *what* changed, not *why* (the body covers why)
- One subject — if changes are genuinely unrelated, say so and suggest splitting the commit

**Body rules (include only when the subject isn't self-explanatory):**
- Blank line between subject and body
- Wrap at 72 characters
- Explain *why* the change was made, or *what problem* it solves — not a restatement of the diff
- Bullet list (`-`) for multiple distinct points; prose for a single coherent reason
- Omit entirely for simple, obvious changes (e.g. "Fix typo in README")

**What to omit:**
- File paths and function names (those are in the diff)
- Phrases like "this commit", "in this PR", "as discussed"
- Test-only or internal-only details unless they're the entire point of the commit

### 4. Output

Print the commit message inside a plain fenced code block (no language tag) so it's easy to copy:

```
Subject line here

Optional body paragraph or bullet list here.
```

Then add one short sentence below the block noting what kind of change this is (new feature / bug fix / docs / chore / etc.) and flagging anything uncertain — for example if the changes span multiple concerns that might be worth splitting.

## Rules

- **Never run `git commit`, `git add`, `git push`, or any command that modifies git state.** Read-only git commands only.
- **Never guess at intent.** If the diff is ambiguous, say so and offer two candidate messages.
- **Do not fabricate a conventional-commit prefix** unless the recent log shows the repo uses them.
- **One message per output.** If the working tree has changes that clearly belong in separate commits, surface that as a note rather than producing multiple messages.
