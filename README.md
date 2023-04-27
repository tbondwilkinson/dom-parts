# DOM Parts Proposal

## Uses Cases

In many applications and frameworks, JavaScript code needs to locate and mutate a set of "nodes of interest." The current methodology for finding "nodes of interest" is either a full DOM tree walk or DOM queries, and for updating either that walk is repeated or the "nodes of interest" are then retained in JavaScript data structures or as properties on the DOM objects.

There are two major drawbacks to these solutions:

1. DOM mutating methods like `clone()` are not aware of in-memory refereces to cloned nodes or special JavaScript properties. They can only clone the HTML content itself.
1. The DOM walks for locating nodes often occur immediately after the browser has already performed that same DOM walk, for example during HTML rendering of the document or `<template>` nodes.

The browser could assist in locating, storing, and updating these nodes with new primitives that identify nodes and ranges of nodes at parse time and an imperative API to retrieve, walk, and update these nodes.

**Summary of Use Cases**

**Template-based Client-side Rendering**: Locating and updating nodes in cloned `<template>` HTML

- **Lit**: Visits placeholders in `<template>` cloned content.
- **SolidJS**: Visits placeholders in `<template>` cloned content.
- **Angular**: Interested in Lit + SolidJS approach
- **Wiz (Google Internal)**: Interested in Lit + SolidJS approach

**Server-side Rendering and Hydration**: Locating and updating nodes in main document HTML

- **Vue, Svelte, others**: Needs to visit DOM nodes to add event listeners, then same use case as template-based client-side rendering. Some frameworks like Qwik only hydrate parts of the page that have interaction.
- **Wiz (Google Internal)**: Locates jscontroller tagged nodes. Locates jsname tagged nodes for jscontrollers.

**Deferred Server-side Rendering**: Declaratively marking locations to be used to later slot in content.

- **React**: Identify a location in the DOM that content that is rendered later should be automatically inserted into.
- **Deferred Rendering (Google Search)**: Identify a location in the DOM that content that is rendered later should be automatically inserted into the page, (display: none content, e.g.).

**Component Representation**: Representing components that do not have a clear reprensetation in the DOM.

- **React**: A component may not be rooted with a single element root and may instead be rooted with 0 or more top-level nodes. No way to represent this in HTML and get behaviors like event listening, DOM measurement.
- **Wiz (Google Internal)**: Component ownership may skip into child components (comparable to `<template>` slots).

## Potential Requirements

These are the potential requirements for a new browser API that solved the above use cases:

1. Markers do not affect rendering.
1. Markers do not affect tree hierarchy.
1. Markers can mark a single node.
1. Markers can mark a range of nodes.
1. Markers can mark attributes.
1. Markers can mark a range of characters within an attribute.
1. Markers can be nested and have hierarchy, and have 1 parent and 0 or more children.
1. Markers are performantly preserved after a DOM clone.
1. Markers are performantly preserved after DOM mutations.
1. Markers are fast to find using an imperative API.
1. Markers can be imperatively created with JavaScript.
1. Markers can be declaratively created with HTML.
   1. The HTML to create a marker does not require a new document parsing mode to parse.
   1. The HTML to create a marker must be emittable by servers using HTML-compliant serializers.
   1. The HTML to create a marker is "universal", and can be output inside or outside of tags.
   1. The HTML to create a marker is ergonomic and directly writable by developers.
   1. There should be only one syntax for declaratively creating a marker.
1. Browsers can use markers for deferred DOM insertion.
1. Browsers can use markers for component features like event listening.

## Use Cases vs Requirements

| Requirement                   | CSR | SSR | Deferred DOM | Declarative CE | Component |
| ----------------------------- | --- | --- | ------------ | -------------- | --------- |
| Do not affect rendering       | X   | X   | X            | X              | X         |
| Do not affect tree hierarchy  | X   | X   | X            | X              | X         |
| Mark a single node            | X   | X   | X            | X              | X         |
| Mark a range of nodes         | X   | X   | X            | X              | X         |
| Mark attributes               | ~   | ~   |              | ~              |           |
| Mark text in attributes       | ~   | ~   |              | ~              |           |
| Markers have hierarchy        | X   | X   |              | X              | X         |
| Preserved after clone         | X   |     |              |                |           |
| Preserved after DOM mutations | X   | X   | X            | X              | X         |
| Performant to retrieve in JS  | X   | X   |              | ~              | X         |
| Imperative syntax             | X   |     |              | ~              |           |
| Declarative syntax            |     | X   | X            | X              | X         |
| > No new document mode        | X   | X   | X            | X              | X         |
| > Marker is valid HTML        | X   | X   | X            | X              | X         |
| > Marker in place             |     |     |              |                |           |
| > Ergonomic syntax            | ~   | ~   | ~            | ~              | ~         |
| > One syntax                  |     |     |              |                |           |

## Proposal

The below DOM parts proposal uses "parts" as the markers into the DOM and satisfies some of the requirements.

1. There is a new clone API that preserves DOM parts.
1. The browser keeps DOM parts alive as long as the elements they mark are alive.
1. _DOM parts are accessible from the document, but it's not always constant time because the browser would defer determining DOM order of parts until the first access._
1. _DOM parts enable accessing DOM nodes, so it's as fast as a normal DOM update, but not faster._
1. `NodePart` marks a single node.
1. `NodePart` can mark a text node and `ChildNodePart` could wrap a text node(s).
1. `ChildNodePart` marks a range of sibling nodes.
1. **There is no ability to mark attributes.**
1. **There is no ability to mark a range of characters within an attribute.**
1. `ChildNodePart` contains parts, as does `DocumentPart`.
1. DOM parts produce comments, which do not affect rendering.
1. DOM parts produce comments, which do not affect tree hierarchy.
1. DOM part processing instruction API creates DOM parts.
   1. **Some HTML-compliant serializers cannot produce processing instructions**
   1. There is no new document mode to parse DOM parts.
   1. There is only one processing instruction syntax.
   1. **Processing instructions are not valid inside tags**
   1. _Processing instructions are arguably not ergonomic_
   1. _DOM parts would enable such other APIs, but does not propose them._
1. DOM parts includes an imperative API.

### Overview

Processing instructions will allow caching nodes of interest during parsing. An imperative API will allow maintaining a live tree of nodes of interest in the DOM. The imperative API is a modification/addition to the original [DOM Parts proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md). For information on how this proposal differs from the original DOM Parts proposal, [see this explainer](./dom_parts_differences.md). For information about the polyfill, [see this explainer](./polyfill.md).

### Processing Instructions

The improvement here requires there be some way to request that the parser preserve pointers to parts of the DOM, but that once these requests to the parser have been parsed, are not preserved in the DOM and have no influence over it.
Processing instructions are an existing well-known quantity in terms of the spec, so it is a convenient write target for this new feature.

This proposal introduces two new processing instructions. An example:

```html
<html>
  <section>
    <h1 id="name"><?child-node-part?><?/child-node-part?></h1>
    Email:
    <?node-part metadata?><a id="link"></a>
  </section>
</html>
```

There are two ways to identify parts:

- `<?node-part?>` which creates a part attached to the next sibling node.
- `<?child-node-part?>` which begins a part `<?/child-node-part?>` which ends the part and can optionally wrap content.

### Imperative API

#### Example

```js
// To retrieve the active list of parts, parsed from HTML or imperatively.
const documentPart = document.getDocumentPart();
const parts = documentPart.getParts();

// If you want to add a new part
const nodePart = new NodePart(document.getElementById("your-element"));

// Or a ChildNodePart
const childNodePart = new ChildNodePart(
  nodePart.node.children[3],
  nodePart.node.children[5]
);

// This part would appear in childNodePart's parts, rather than the document part.
const nestedNodePart = new NodePart(nodePart.node.children[4]);

// Updated to reflect the new imperatively added parts.
const updatedParts = documentPart.getParts();
```

#### Details

Once parsed, these parts are contained in `PartRoot` objects, which are accessible off of `Document` or `DocumentFragment` nodes.

```ts
interface PartRoot {
  // In-order DOM array of parts.
  getParts(): Part[];
}

class DocumentPart implements PartRoot {
  constructor(document: Document | DocumentFragment) {}

  getParts(): Part[];

  clone(): DocumentPart;
}

declare global {
  interface Document {
    getDocumentPart(): DocumentPart;
  }

  interface DocumentFragment {
    getDocumentPart(): DocumentPart;
  }
}
```

The browser does fancy bookkeeping to ensure that `getParts()` is live, but it may defer some work to actual calls, as `getElementById()` does.

`DocumentPart` also has a clone method which also clones the parts.

The base interfaces for all parts is:

```ts
interface Part {
  readonly root?: PartRoot;
  readonly metadata: string[];

  disconnect(): void;
}
```

`root` is a pointer to the `PartRoot` this part is in. `metadata` is additional parsing metadata attached to the `Part`. `disconnect()` removes the Part from its root.

A `NodePart` is constructed for `<?node-part?>` instructions and can also be constructed imperatively.

```ts
class NodePart implements Part {
  readonly root?: PartRoot;
  readonly metadata: string[];

  readonly node: Node;

  constructor(node: Node, init: { metadata?: string[] } = {}) {}

  disconnect(): void;
}
```

A `ChildNodePart` is constructed for `<?child-node-part?>` instructions and can also be constructed imperatively.

```ts
class ChildNodePart implements Part, PartRoot {
  readonly root?: PartRoot;
  readonly metadata: string[];

  readonly previousSibling: Node;
  readonly nextSibling: Node;

  constructor(
    previousSibling: Node,
    nextSibling: Node,
    init: { metadata?: string[] } = {}
  ) {}

  children(): Node[] {}

  // All parts in this subtree.
  getParts(): Part[] {}

  // Replaces the children and parts in this range.
  replaceChildren(...nodes: Array<Node | string>) {}

  disconnect(): void;
}
```

`ChildNodePart` is constructed with `previousSibling` and `nextSibling` nodes. The validity of the `ChildNodePart` is determined from those nodes - they must be ordered, contiguous, and non-overlapping with any other `ChildNodePart` objects.

Invalid `ChildNodePart` objects are still accessible in with `getParts()`, but never have children.

Unlike `NodePart`, `ChildNodePart` is also a `PartRoot` like a `Document` or `DocumentFragment`. This means that it can contain content and nodes, and can be a `PartRoot` for other parts.

## FAQ

### Processing Instruction Alternatives

Processing instructions have some drawbacks as well. The major drawback is that they are not commonly output by HTML generating libraries, and so it may be a challenge for adoption in those libraries.

Additionally processing instructions cannot be output inside tags, so possible extensions like attribute parts are more difficult to express.

Alternatives to processing instructions considered:

1. Comments with specific structure. These could be used in place of processing instructions but are not valid inside tags.
1. A new special character, for example `{}` that could be specially parsed in a document mode. This comes with all the drawbacks of complexity for a new document mode.
