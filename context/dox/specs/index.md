# Dox specs

A Dox execution spec exists only while its story is in progress. It is written for `dox-builder`
and verified by `dox-tester`. When the story is Done, the finalizer folds its decisions into
[built.md](../built.md) (or a `reference/` file) and deletes it. The tier-level record of what is
built is [built.md](../built.md).
