# Dox specs

A Dox execution spec exists only while its story is in progress. It is written for `dox-builder`
and verified by `dox-tester`. When the story is Done, the finalizer moves any rule the code cannot show into the
matching [built/](../built/index.md) file (or a `reference/` file) and deletes the spec. The tier-level
record of what is built is [built/](../built/index.md).

In progress:

- [dox-g2/](./dox-g2/index.md): DOX-G2, one entrance from northguild.dev to /gmt (header, hero, sky, entrance, tables, carousel).
- [dox-g13/](./dox-g13/index.md): DOX-G13, a PTP Clock Converter preset inside the 2016-12-31 leap second.
