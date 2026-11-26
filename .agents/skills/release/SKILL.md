---
name: release
description: "Open the release pull request — work out the next versions with `changeset status`, make a `release/<YYYY-MM-DD>` worktree from origin/main (through the worktree CLI where it is set up, opened in Herdr where Herdr is in use), follow PUBLISHING.md step 3 in it, then commit, push and open the PR. Only when the user types /release. Never for 'ship it', 'cut a release', or a release looking due."
disable-model-invocation: true
argument-hint: "[branch name — defaults to today's date]"
---

# /release

Opens the release pull request that [PUBLISHING.md](../../../PUBLISHING.md) step 3 describes, and stops
there. **It publishes nothing.** Merging the pull request publishes, and nothing in this skill merges.

## Usage

```text
/release            # branch release/<today>, e.g. release/2026-11-02
/release <name>     # branch release/<name>
```

**The branch is named for the day, not a version.** Each package is versioned on its own and there is
no repo-wide `vX.Y.Z` tag, so a version names one package at best — and a release can move only the
lint plugins. The versions go in the commit subject and the PR title, once they are known. Nothing in
CI reads the branch name: `ci.yml` recognises a release PR by its consumed changesets.

**Typing `/release` is the instruction** for this run's branch, commit, push and pull request, as
[AGENTS.md § Git](../../../AGENTS.md#git--only-on-an-explicit-instruction) requires. It covers this
run only. It never covers a merge, a force-push or a push to `main`, and it is never inferred from
"ship it", an approved plan, or a release looking overdue.

## 1. Check before creating anything

The current tree can be any checkout of this repository: the release branches from `origin/main`,
never from here. Stop at the first check that fails and say which one.

1. `git fetch origin main`. **Something is pending:** `git ls-tree --name-only origin/main .changeset/`
   lists at least one `.md` file besides `README.md`. None → say there is nothing to release.
2. **The name is free:** no local branch `release/<name>`, none on `origin` (`git ls-remote --heads
   origin release/<name>`), and no worktree on it (`git worktree list`). Do not add a suffix. An
   existing release branch is a release in progress or an abandoned one, and both need a person.
3. **No other release PR is open:** `gh pr list --state open --json number,title,headRefName,labels`
   has no head starting `release/` or `publish/` and none labelled `release`. Two release PRs consume
   the same changesets, and whichever merges second conflicts. Name the open one.
4. **`gh auth status` succeeds**, so the pull request can be opened at the end.

## 2. Make the worktree

The branch is `release/<name>`, made from `origin/main`. Work out two things first:

- **The worktree CLI is set up here:** `command -v worktree` succeeds and
  `worktree config defaultSourceBranch --non-interactive` prints a value.
- **Herdr is in use:** `$HERDR_ENV` is set, or `herdr status server` prints `status: running`.

Then make the tree with the first that applies:

| Setup | Command |
|---|---|
| Worktree CLI | `worktree branch release/<name> --source origin/main --no-agent --install --non-interactive --json` |
| Plain git | `git worktree add --no-track -b release/<name> <path> origin/main`, then `pnpm install --frozen-lockfile` in it |

- **Worktree CLI:** read `path` from the JSON. A non-zero exit → stop and report its `error`. The CLI
  opens the tree wherever its `opener` setting says, and `herdr` there means a Herdr space. If Herdr is
  in use but `worktree config opener` is not `herdr`, add `--no-open` and open the tree in Herdr
  yourself (next bullet), so it does not open twice.
- **Plain git:** `<path>` is `<main checkout>.worktrees/release/<name>`, beside the main checkout,
  which is the parent of `git rev-parse --path-format=absolute --git-common-dir`.
- **Herdr, when the tree is not already open there:**
  `herdr worktree open --path <path> --label release/<name> --no-focus`. If it fails, report it and
  carry on, because the release does not depend on it. Never add `--trust-repository` yourself.

**Run everything below inside the new tree.** Start each shell command with `cd <path> &&`, because
the shell may not keep its directory between calls.

## 3. Work out the versions

Run `pnpm exec changeset status --output=<file>`, with `<file>` outside the tree (for example under
`mktemp -d`) so it cannot end up in the commit. Its `releases[]` gives `name`, `type`, `oldVersion`
and `newVersion` for each package. Ignore any with `type: none`.

- **Nothing left after that** → stop. Nothing would be published.
- **A `major`** → stop and name the changeset (`changesets[]` in the same file). PUBLISHING.md never
  uses `major`. The fix is an edit to that changeset on `main`, not here.

On either stop, remove the tree and branch this run made, with the same tool that made them
(`worktree remove release/<name> -f`, or `git worktree remove <path>` and `git branch -D
release/<name>`). They hold nothing yet.

## 4. Prepare the release, as PUBLISHING.md says

Read **`PUBLISHING.md` in the new tree** (that copy is the one on `origin/main`), step 3 "When you want
to release" and its notes. Do what step 3 says, up to opening the pull request, and nothing it puts
after the merge. Where that file and this skill disagree, the file wins. When this skill was written,
step 3 was `pnpm run changeset:version`.

**The version command runs once.** If it fails part-way, stop and report what it printed and what
state the tree is in. Do not run it again and do not repair the tree.

## 5. Read the diff before committing

Read `git status` and `git diff` in the tree. Stop without committing if either of these is true:

- **A version differs from what step 3 predicted**, or a package moved that no changeset named.
- **A file changed that step 3 does not account for.** The expected changes are package versions,
  `CHANGELOG.md` entries, deleted `.changeset/*.md` files, and the Intent skills' `library_version`
  pins. A new `.changeset/*.md` is never expected: the Release workflow refuses to publish while one is
  pending.

**Report any changelog entry that reads wrong, and leave it as it is.** That text is what npm and the
GitHub Release will show, and changing it is the reviewer's decision on the pull request. Never
hand-edit a version.

**Then pack what the merge would publish**, the way the Release workflow does, with `<dir>` outside
the tree:

```bash
pnpm --filter "./packages/*" --if-present run build
pnpm exec changeset publish-plan --output <dir>/publish-plan.json
pnpm exec changeset pack --from-publish-plan <dir>/publish-plan.json --out-dir <dir>/pack
```

Stop without committing if any command fails, or if `<dir>/pack` does not hold one `.tgz` for each
package step 3 found. Report the error. Do not fix it on the release branch: a fix to a package needs
its own changeset, and the Release workflow does not publish while a changeset is pending. CI's
`Release pack dry run` job packs the tarballs again on the pull request, on the Release workflow's
Node, so it catches a failure that only happens in CI (#453).

## 6. Commit, push and open the pull request

- **One commit holding everything step 4 produced.** Subject: `release: v<version>` with the
  `@northguild/gmt` version when it moved, as earlier releases did. When it did not move, list what did,
  e.g. `release: gmt-eslint 1.1.2, gmt-oxlint 1.2.2`.
- **Push with `git push -u origin release/<name>`.** If the push is rejected, stop and say the commit
  is in the tree and has not been pushed.
- **`gh pr create --base main --head release/<name> --title "<subject>" --label release
  --body-file <file>`**, with the body file outside the tree. If the label does not exist, open the
  PR without it and say so. Then run `node scripts/pr-meta.mjs --apply` to ask the other
  collaborator for review.

Write the body in plain English (the [`plain-english` skill](../plain-english/SKILL.md)):

1. One opening line: "Release PR — version bumps and changelogs only. Merging publishes" followed by
   each `package@version`.
2. Every version that moved, from → to, with its level. Call out any **Breaking changes** section.
3. The changesets consumed, by file name, and each package's `CHANGELOG.md` on this branch.
4. What merging does, and what is left to do after it. Take both from PUBLISHING.md; do not guess.

**Nothing merges it.** Do not enable auto-merge and do not wait for CI.

## 7. Report

- The branch, the tree's path, whether the worktree CLI or plain git made it, and whether it opened
  in Herdr.
- Every version that moved, from → to.
- The pull request's URL, and that **nothing is published until a person merges it**.
- Anything step 5 flagged, and the tarballs the pack in step 5 made.
- That CI's `Release pack dry run` job has to pass before anyone merges.
- What PUBLISHING.md says to do after the merge.
- That the release tree is still there. Remove it after the merge, with `worktree remove
  release/<name>` or `git worktree remove <path>`.

## Rules

- Branch from `origin/main`. Never release from the current tree or on `main`.
- Run the version command once, and never hand-edit a version or a changelog.
- Never add a changeset to the release branch.
- Never merge, force-push, push to `main`, or run `npm publish`.
