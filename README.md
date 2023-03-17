# DOM Parts Proposal

## Uses Cases

In many applications, JavaScript code needs to locate and mutate a set of "nodes of interest." The current methodology for finding "nodes of interest" is either a full DOM tree walk or DOM queries, and then retaining them with in-memory JavaScript caching.

The browser could assist in locating, storing, and updating these nodes with new primitives that identify nodes and ranges of nodes at parse time and an imperative API to retrieve, walk, and update these nodes.

### Hydration

[Hydration](<https://en.wikipedia.org/wiki/Hydration_(web_development)>) takes rendered HTML from a server and enhances it with JavaScript to add event listeners that can respond to user input.

In hydration, the "nodes of interest" are visited and event listeners are added.

#### Google Wiz

The internal Web framework at Google, Wiz, does light hydration on server-side rendered HTML. As part of this, it looks for controller attributes that annotate JavaScript that needs to be downloaded for the page to become interactive and it annotates elements that the controller will be interested in mutating either as part of rendering or in response to interaction.

The nodes of interest are annotated with attributes like `jsaction`, `jscontroller`, and `jsname` and they are retrieved via DOM walks and queries.

### Client-side Rendering

Many modern frameworks finish rendering an application on the client after the initial page load, or do a follow-up re-render of a part of the application in response to user interaction or data changes.

#### `<template>` based rendering

Frameworks like Lit use `<template>` to represent the static parts of a rendered chunk of content. With Lit, the `<template>` is populated with content that is attributed with placeholder attributes and comments. Then the framework clones the `<template>` content and walks the clone looking for those placeholders to update. The frameowrk stores pointers to the nodes where it found placeholders so that it can later use that to optimally update the content in response to data changes.

Other frameworks like Angular are interested in a `<template>` cloning approach to rendering clientside DOM.

### Other querying needs

Other hydration and rendering strategies may also benefit from having a new way of querying nodes besides with a selector. Current strategies have some drawbacks: there is the possibility of conflicting `id` elements, and there's no way to query quickly for ranges of nodes.

### Further extensions

There are other possible extensions of this API that take advantage of a browser-based node or range identifier, for instance for inserting content that is streamed later in a response into placeholder locations declaratively to speed up displaying more important content.

## Proposal

### Overview

Processing instructions will allow caching nodes of interest during parsing. An imperative API will allow maintaining a live tree of nodes of interest in the DOM. The imperative API is a modification/addition to the original [DOM Parts proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md). For information on how this proopsal differs from the original DOM Parts proposal, [see this explainer](./dom_parts_differences.md).

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

Once parsed, these parts are contained in `PartRoot` objects, which are accessible off of `Document` or `DocumentFragment` nodes.

```js
interface PartRoot {
  // In-order DOM array of parts.
  getParts(): Part[];
}

class DocumentPart implements PartRoot {
  constructor(document: Document|DocumentFragment) {}

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
  readonly valid: boolean;
  readonly metadata: string[];

  disconnect(): void;
}
```

`root` is a pointer to the `PartRoot` this part is in. `valid` is whether or not the `Part` is valid, `metadata` is additional parsing metadata attached to the `Part`. `disconnect()` removes the Part from its root.

A `NodePart` is constructed for `<?node-part?>` instructions and can also be constructed imperatively.

```ts
class NodePart implements Part {
  readonly root?: PartRoot;
  readonly valid: boolean;
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
  readonly valid: boolean;
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
