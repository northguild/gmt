# Steps

### 1. Find all pending changeset files

```bash
ls .changeset/*.md | grep -v README.md
```

Read each one. Note which packages are affected and what bump type (`patch` / `minor` / `major`) is declared.

### 2. Run the pr-desc skill internally

Invoke the `pr-desc` skill (or follow its steps directly: `git log --oneline main..HEAD`, `git diff main...HEAD --stat`, then read key changed files) to build a complete understanding of what changed on this branch. You don't need to output the full PR description — just use it to ground your understanding of the changes.

### 3. Read the existing CHANGELOG for each affected package

For each package listed in the changeset frontmatter, read its `CHANGELOG.md` (e.g. `packages/gmt/CHANGELOG.md`). Study the tone, length, and structure of recent entries at the same bump level:

- **Major** entries: typically include a multi-paragraph summary describing the full scope of what was introduced.
- **Minor** entries: typically one lead sentence, then a bulleted list of new exports or capabilities. Concise — usually under 20 lines.
- **Patch** entries: typically a single sentence per fix, starting with an action verb ("Fix", "Add", "Correct").

Match that style. Do not introduce a format that doesn't exist in recent history.

### 4. Write the improved description

Rewrite the free-form body of the changeset file (everything after the `---` front matter closing fence). Keep the frontmatter unchanged.

Guidelines:

- **Lead with what consumers get**, not what files changed. "Adds six relative time formatters" not "adds formatRelativeDate.ts".
- **Name every new public export** that a consumer would `import`. Group them logically (e.g. plain / zoned / unix / utc) if there are many.
- **For options**, describe only the ones that aren't obvious from the name — especially any that interact in non-obvious ways, have a non-default value worth knowing, or affect output format.
- **For bug fixes**, state the broken behavior and what it does now.
- **For internal / test-only changes** (new mocks, probe helpers, internal utilities): omit entirely unless they affect how consumers test against the library.
- **No file paths**, no commit SHAs, no branch names. Those belong in git history, not changelogs.
- Use imperative mood for patch items ("Fix X", "Correct Y"). Use noun phrases for minor/major additions ("New `formatRelativeDate` formatter — …").
- Match the line length and bullet density of the existing entries in that package's CHANGELOG.

### 5. Write back the changeset file

Overwrite `.changeset/<slug>.md` with the improved description, preserving the frontmatter exactly. Do not change the filename.

### 6. Show the diff and ask for confirmation

Print the before/after of the changeset body so the user can review it before accepting. Ask:

> "Does this look right, or would you like to adjust the wording?"

Do not proceed to commit or run any changeset commands — this skill only edits the `.changeset/*.md` file.
