# Git — Only on an Explicit Instruction

**The default is always: finish the work, leave it unstaged in the working tree,
and say it is ready.** Do not stage, commit, branch, push or open a pull request
on your own initiative — not as a checkpoint, not "so nothing is lost", not
because the work looks finished. The only exceptions are the two standing
instructions at the end of this section.

**Do them when the user tells you to, in plain words, in the current session.**
"Commit this", "push the branch", "open the PR" are instructions: carry them out
and report what you did. An instruction covers the operation it names for the
work in hand. It is not a standing licence — a later, separate write needs its
own instruction, unless it is one of the two standing instructions below. Typing a skill whose job is one of these operations is the
instruction for that run: `/release` commits, pushes and opens its release PR.

**Never infer the permission.** It has to come from the user, about this
operation, in their own words:

- A user choosing between approaches is **not** authorising the git operations
  named in the options. If an agent writes "…and open it as a PR" into a choice
  it offers, selecting that choice authorises **nothing** — the agent wrote that
  text, not the user.
- "Ship it", "land it", "let's go", approving a plan, or agreeing that work is
  finished are **not** requests to push or open a PR. They are about the work,
  not about git.
- Urgency is not a reason on its own. A bug being live in production is a reason
  to _tell the user_, not to push a fix nobody asked for.
- A "yes" to a different question is not a yes to this one.

**Destructive and wide-reaching variants have to be asked for by name.**
`--force` / `--force-with-lease`, a push to `main` or any default branch, a
rewrite of published history, and `git reset --hard` over uncommitted work are
authorised only when the user asks for that specific thing. "Push the branch"
does not authorise force-pushing it.

If one of these seems genuinely necessary and nobody has asked for it, stop and
ask in plain words.

**Two standing instructions from the owner.** These need no new word each time:

- **Keep the branch up to date with `main`.** Do this when work on a branch starts, as
  `finalizer`'s first step (before it edits the READMEs or the tracker), and before any push.
  Commit the merge only, never the story's own work. Run `git fetch origin main`, then
  `git merge origin/main` when the branch is behind. Never rebase, because the branch is
  published. Resolve every conflict so both sides' changes survive, run
  `node scripts/verdict.mjs validate`, and commit the merge. At `finalizer`'s first step, commit
  the resolved merge without `validate`: the story's published figures are synced only at its
  step 4, so `validate` would fail for a reason the merge did not cause, and its step 9 runs
  `validate` on the merged tree before hand-off. If uncommitted work touches the
  incoming files, git refuses the merge. Do not stash (the stash is shared): name the files to
  the owner and merge once the work is committed. Pushing the merge still needs the owner's word.
  On an open PR, `gh pr view --json mergeable` shows whether GitHub sees a conflict.
- **A PR gets its labels, milestone and reviewer.** Run `node scripts/pr-meta.mjs --apply` right
  after a PR is opened, and when `finalizer` closes a story whose PR is already open. It only
  adds: labels from the commit types and changed paths, the closed issue's milestone (else the
  story's tracker), and the other collaborator as reviewer. A run without `--apply` changes
  nothing and shows the plan.
