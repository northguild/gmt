# Dox specs

A Dox execution spec exists only while its story is in progress. It is written for `dox-builder`
and verified by `dox-tester`. When the story is Done, the finalizer moves any rule the code cannot show into the
matching [built/](../built/index.md) file (or a `reference/` file) and deletes the spec. The tier-level
record of what is built is [built/](../built/index.md).

In progress:

- [dox-g2/](./dox-g2/index.md): DOX-G2, one entrance from northguild.dev to /gmt (header, hero, sky, entrance, tables, carousel).
- [core-115/](./core-115/index.md): CORE-115 Dox, the Operating Schedule Checker, the Opening Hours Board and the guide rule that a refused schedule is not a closed one.
