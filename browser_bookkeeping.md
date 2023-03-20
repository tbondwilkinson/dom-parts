# Browser Book-keeping

In order to keep the `Part` objects up to date with the DOM, the browser needs to keep some extra data on nodes and run a few extra steps on `Node` addition or removal.

## Extra Node Fields

For each node there should be a few extra fields:

1. A `nodePart` link to a `NodePart`, if any. This is used to locate `Part` objects when a `PartRoot` needs to update its parts.
2. A `childNodePartPreviousSibling` link to a `ChildNodePart`. This is the `Node` that begins, but is not included in, a `ChildNodePart` range. This is used to locate `Part` objects and to determine whether two `ChildNodePart` ranges overlap.
3. A `childNodePartNextSibling` link to a `ChildNodePart`. This is the `Node` that ends, but is not included in, a `ChildNodePart` range. This is used to locate `Part` objects and to determine whether two `ChildNodePart` ranges overlap.
4. A `childNodePartOwned` link to a `ChildNodePart`. This is the siblings in between `previousSibling` and `nextSibling` nodes that are not in between some other `previousSibling` and `nextSibling` nodes. This is useful to locate the `PartRoot` of a node, when iterating up through the DOM. Otherwise a new `Node` may not locate the `ChildNodePart` that it belongs to. It is only present on the top-level siblings of a `ChildNodePart`.
5. A `childNodePartParentDirty` bit that determines whether a parent of `ChildNodePart` objects has had those objects validated since a child was added or removed.
6. A link to a `DocumentPart` for a `Document` or `DocumentFragment`.

## getParts()

`getParts()` is a cached DOM-order list of parts that can be marked as dirty whenever a node is inserted with a `Part` object whose relative location in its `PartRoot` parent is unknown. The `PartRoot` has to do a full subtree walk of any nodes that have `Part` fields.

## `.partRoot`

`.partRoot` is a dynamic parent walk to locate the parent `PartRoot`. It's expected that most operations will do child part walks rather than parent walks. To search for a parent `PartRoot`, walk the nodes looking for either a `childNodePartOwned` link to a valid `ChildNodePart` or a node with a `DocumentPart`.

## Validity checking `ChildNodePart`

`ChildNodePart` objects have various validity requirements:

1. `previousSibling` and `nextSibling` are connected nodes.
2. `previousSibling` and `nextSibling` have the same parent node.
3. `previousSibling` precedes `nextSibling`.
4. The `ChildNodePart` does not intersect with any other `ChildNodePart` range.

Given a parent, it's possible to do validity checking by iterating over all child nodes.

The process of checking validity and updating nodes is as follows:

1. Iterate over all children, looking for `childNodePartPreviousSibling` and `childNodePartNextSibling` links.
2. For each `childNodePartPreviousSibling` link, push that `ChildNodePart` onto the `ChildNodePart` stack.
3. If any `ChildNodePart` ends prematurely (before a child `ChildNodePart` ends), this and all `ChildNodePart` objects after it on the stack are marked as invalid.
4. If a `childNodePartNextSibling` is found before its `childNodePartPreviousSibling`, mark the `ChildNodePart` as invalid.
5. If the iteration reaches the end of the children list and some `ChildNodePart` is still on the stack, it is invalid.
6. Visit all children again updating the `childNodePartOwned` links to the newly validated `ChildNodePart` objects.
7. Set `childNodePartParentDirty` bit to false.
8. If the validation resulted in any changes, set the child parts dirty bit to true for all valid `ChildNodePart` objects.
9. For all invalid `ChildNodePart`, set all parts to empty lists.

In all, this visits every child of a parent with some `ChildNodePart` twice - once for validity, and once to populate the `childNodePartOwned` link.

## DOM Mutations

### On Node Removal

For every node being disconnected, check whether it has one of the above extra `Node` fields.

1. If it has a `NodePart`, disconnect the `NodePart` which removes it from the parent `PartRoot` parts. The parts list is still correct because there are no additions. Mark the `NodePart` as invalid.
2. If it has a `previousSibling` or `nextSibling` link to a `ChildNodePart` and the `ChildNodePart`, disconnect the `ChildNodePart` which removes it from the parent `PartRoot` parts. Mark the parent `PartRoot` parts list as dirty, as there may now be arbitrary new children or `ChildNodePart` objects that are newly valid. Mark the parent node's `childNodePartParentDirty` bit to true.
3. If it has a `childNodePartOwned` link, remove the `childNodePartOwned` link.

### On Node Addition

For every node being connected, check whether it has one of the above extra `Node` fields.

1. If it has a `NodePart` and that part is currently disconnected, connect the `NodePart` which adds it to the `PartRoot` parts. Mark the `PartRoot` parts list as dirty.
2. If it has a `previousSibling` or `nextSibling` link to a `ChildNodePart`, connect the `ChildNodePart` which adds it to the `PartRoot` parts. Mark the `PartRoot` parts list as dirty. Mark the parent node's `chldNodePartParentDirty` bit to true.

## On Part construction

`Part` construction runs the same `Node` addition algorithm, except that for `ChildNodePart` it validates the parent and its children and throws if they are invalid.

## Optimized Part methods

### replaceChildren

`replaceChildren` can be a bit more smart about Parts in the added children because the children are adopted in order and the `ChildNodePart` is replaced in totality, as long as all the `Part` objects being added are valid.
