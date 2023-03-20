# Browser Book-keeping

In order to keep the `Part` objects up to date with the DOM, the browser needs to keep some extra data on nodes and run a few extra steps on `Node` addition or removal.

## Extra Node Fields

For each node there should be a few extra fields:

1. A link to a `NodePart`, if any.
2. A `previousSibling` link to a `ChildNodePart`. This is the `Node` that begins, but is not included in, a `ChildNodePart` range.
3. A `nextSibling` link to a `ChildNodePart`. This is the `Node` that ends, but is not included in, a `ChildNodePart` range.
4. A `root` link to a `ChildNodePart`. This is the siblings in between `previousSibling` and `nextSibling` `Node` that are not in between some other `previousSibling` and `nextSibling` nodes. This is useful to locate the `PartRoot` of a node, when iterating up through the DOM. Otherwise a new `Node` may not locate the `ChildNodePart` that it belongs to.
5. A link to a `DocumentPart` for a `Document` or `DocumentFragment`.

## DOM Mutations

### On Node Removal

For every node being disconnected, check whether it has one of the above extra `Node` fields.

1. If it has a `NodePart`, disconnect the `NodePart` which removes it from the parent `PartRoot` parts. The parts list is still correct because there are no additions. Mark the `NodePart` as invalid.
2. If it has a `previousSibling` or `nextSibling` link to a `ChildNodePart`, first take all the `Part` children of this `ChildNodePart` and splice them into the parts list of the parent `PartRoot` of this `ChildNodePart`. If a `ChildNodePart` is removed or invalidated, its parts are adopted by its parent `PartRoot` in the same location. Then, visit all next siblings of `previousSibling` and previous siblings of `nextSibling` removing `root` links, until the first `Node` without a `root` link is found, indicating some other `ChildNodePart` owns the rest of those nodes. Mark the `ChildNodePart` as invalid. Disconnect the `ChildNodePart` if both `previousSibling` and `nextSibling` are disconnected which removes it from the parent `PartRoot` parts. Otherwise, mark the `ChildNodePart` as invalid.
3. If it has a `root` link, remove the `root` link.

### On Node Addition

For every node being connected, check whether it has one of the above extra `Node` fields.

1. If it has a `NodePart` and that part is disconnected, connect the `NodePart` which adds it to the `PartRoot` parts. Mark the `PartRoot` parts for re-ordering, so that next time `getParts()` is called a DOM walk will happen to re-order the parts.
2. If it has a `previousSibling` or `nextSibling` link to a `ChildNodePart`, do:
   1. If it's connected, take no action. This can happen if an entire subtree gets added together with parts and their structures.
   2. If `previousSibling` and `nextSibling` are not both connected or do not share the same parent, add it to the parent's `PartRoot` parts but do not mark for re-ordering since it is invalid, and invalid parts should be filtered.
   3. Check to see whether this range newly invalidates any other `ChildNodePart` ranges by iterating the siblings between `previousSibling` and `nextSibling` looking for `ChildNodePart` links. If links are found, invalidate any found `ChildNodePart` as well as this one, and adopt child parts into the `PartRoot` with a splice, as in the node removal case.
   4. If it's valid, connect the `ChildNodePart` which addds it to the `PartRoot` parts. Mark the `PartRoot` parts for re-ordering, so that next time `getParts()` is called a DOM walk will happen to re-order the parts. Walk the next siblings of `previousSibling` and previous siblings of `nextSibling` adding `root` links, until some other `Node` with a `root` link is found.

On `Node` addition it's difficult to tell where a `Part` should be added in the `PartRoot` parts list, so the browser defers that work. As a result, `Node` additions with `Part` objects should be avoided as they could invalidate.

### On Part construction

`Part` construction runs the same `Node` addition algorithm, except that if the `Part` is invalid the constructor throws and takes no action.

## Other options

Rather than storing a single part list at the root where the `PartRoot` is, each `Node` could have a partial part list for it and its subtree, such that adding a new `Part` only needs to do a parent walk and can know precisely where to insert the `Part` based on adjacent `Node` partial part lists by looking at the children of each node in its parent walk. This removes the cache invalidation but explodes the amount of storage. Storage could be optimized, for instance storing start and end indexes of parts at each node, rather than all subtree parts, but it still has more memory cost than a cached part list.
