# Browser Book-keeping

In order to keep the `Part` objects up to date with the DOM, the browser needs to keep some extra data on nodes and run a few extra steps on `Node` addition or removal.

## Extra Node Fields

For each node there should be a few extra fields:

1. A link to a `NodePart`, if any. This is used to locate `Part` objects when a `PartRoot` needs to update its parts.
2. A `previousSibling` link to a `ChildNodePart`. This is the `Node` that begins, but is not included in, a `ChildNodePart` range. This is used to locate `Part` objects and to determine whether two `ChildNodePart` ranges overlap.
3. A `nextSibling` link to a `ChildNodePart`. This is the `Node` that ends, but is not included in, a `ChildNodePart` range. This is used to locate `Part` objects and to determine whether two `ChildNodePart` ranges overlap.
4. A `root` link to a `ChildNodePart`. This is the siblings in between `previousSibling` and `nextSibling` `Node` that are not in between some other `previousSibling` and `nextSibling` nodes. This is useful to locate the `PartRoot` of a node, when iterating up through the DOM. Otherwise a new `Node` may not locate the `ChildNodePart` that it belongs to. It is only present on the top-level siblings of a `ChildNodePart`.
5. A link to a `DocumentPart` for a `Document` or `DocumentFragment`.

## getParts()

`getParts()` is a cached DOM-order list of parts that can be marked as dirty whenever a node is inserted with a `Part` object whose relative location in its `PartRoot` parent is unknown. The easiest algorithm to order `Part` objects is to do a DOM traversal, but it's possible instead to start with `Part` objects and do parent walks to adjacent children, which significantly reduces the amount of nodes that need to be walked - only parents of `Part` objects and siblings.

## `.partRoot`

`.partRoot` is a dynamic parent walk to locate the parent `PartRoot`. It's expected that most operations will do child part walks rather than parent walks. To search for a parent `PartRoot`, walk the nodes looking for either a `root` link to a `ChildNodePart` or a `DocumentPart`.

## Validity checking `ChildNodePart`

`ChildNodePart` objects have various validity requirements:

1. `previousSibling` and `nextSibling` are connected nodes.
2. `previousSibling` and `nextSibling` have the same parent node.
3. `previousSibling` precedes `nextSibling`.
4. The `ChildNodePart` does not intersect with any other `ChildNodePart` range.

Given a set of `ChildNodePart` objects, it's possible to do validity checking by doing constant time checks for #1 and #2, and then iterating over all nodes between `previousSibling` and `nextSibling` to both checks for contiguousness and non-overlapping. The links for `previousSibling` and `nextSibling` can be used to locate if two `ChildNodePart` ranges overlap. If two `ChildNodePart` ranges overlap, both are invalid.

The process of checking validity and updating nodes is as follows:

1. Take all `ChildNodePart` objects and check them for connectedness and parent equivalence. If either check is invalid, mark the `ChildNodePart` as invalid.
2. For all `ChildNodePart` objects that remain, separate them into lists by parent. For each parent, iterate over all children. It's possible as an optimization to only iterate over `ChildNodePart` ranges by starting with some `previousSibling` and iterating forward, repeatedly until all `ChildNodePart` objects have been found. If a `previousSibling` or `nextSibling` link is found for a `ChildNodePart` that was not originally in the set of `ChildNodePart` objects, add it in and do validity checking for it.
3. For any `root` marked nodes, remove the `root` field, as these will be re-added at the end.
4. If any `ChildNodePart` ends prematurely (before a child `ChildNodePart` ends), this and all open `ChildNodePart` objects are also invalid.
5. If a `ChildNodePart` `nextSibling` is found before its `previousSibling`, it is invalid.
6. If the iteration reaches the end of the children list and some `ChildNodePart` is still open, it is invalid.
7. For all invalid `ChildNodePart` objects with children, remove all children and mark the parent `PartRoot` part list as dirty, as it may now own the child parts of this now invalid `ChildNodePart`.
8. For all valid `ChildNodePart` objects, walk the adjacent siblings adding back in the `root` field.
9. For any newly valid `ChildNodePart` objects, mark the part list as dirty.

In all, this visits every child of a parent with some `ChildNodePart` twice - once for validity, and once for the `root` field.

## DOM Mutations

### On Node Removal

For every node being disconnected, check whether it has one of the above extra `Node` fields.

1. If it has a `NodePart`, disconnect the `NodePart` which removes it from the parent `PartRoot` parts. The parts list is still correct because there are no additions. Mark the `NodePart` as invalid.
2. If it has a `previousSibling` or `nextSibling` link to a `ChildNodePart`, first take all the `Part` children of this `ChildNodePart` and splice them into the parts list of the parent `PartRoot` of this `ChildNodePart`. If a `ChildNodePart` is removed or invalidated, its parts are adopted by its parent `PartRoot` in the same location. Then, visit all next siblings of `previousSibling` and previous siblings of `nextSibling` removing `root` links, until the first `Node` without a `root` link is found, indicating some other `ChildNodePart` owns the rest of those nodes. Mark the `ChildNodePart` as invalid. Disconnect the `ChildNodePart` if both `previousSibling` and `nextSibling` are disconnected which removes it from the parent `PartRoot` parts. Otherwise, mark the `ChildNodePart` as invalid.
3. If it has a `root` link, remove the `root` link.

### On Node Addition

For every node being connected, check whether it has one of the above extra `Node` fields.

1. If it has a `NodePart` and that part is currently disconnected, connect the `NodePart` which adds it to the `PartRoot` parts. Mark the `PartRoot` parts list as dirty.
2. If it has a `previousSibling` or `nextSibling` link to a `ChildNodePart`, add that `ChildPartRoot` to a list to perform validity checking.

Finally, run validity checking on the `ChildNodePart` objects that were found in #2. This may visit every `ChildNodePart` sibling at most twice more.

## On Part construction

`Part` construction runs the same `Node` addition algorithm, except that if the `Part` is invalid the constructor throws and takes no action.

The drawback of a dynamic `Part` list and dirty checking is that for code that is already doing a DOM walk and constructed a series of parts, the code may know precisely where to insert the additional `Part`. If this is a common use case, it may make sense to have some other API like a `TreeWalker` that allows for `Part` creation in a more optimized manner where the ordering of `Part` objects can be guaranteed during the DOM walk, similar to how the parser does it.

If DOM-order is not important, there may be a separate API that couuld be provided that would not be as expensive, because it's easier to keep a list of parts in arbitrary order than it is to keep a list of parts in DOM order.
