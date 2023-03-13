# DOM Parts Proposal

## Motivation

In many applications, the HTML and CSS sent to the browser in the initial HTTP response does not constitute a static or even fully rendered page. In response to user input, as a loading optimization, or for other reasons the HTML of the page is dynamically modified by JavaScript to add, remove, or update content on the page. One common approach in frameworks is to use a static template and dynamic data to render or update the content of the page.

Templating systems come in many varieties, but most begin as a user-authored "template" that is parsed on the client or compiled to JavaScript or other web primitives:
- [React's JSX/TSX](https://reactjs.org/docs/jsx-in-depth.html) which compiles to JavaScript.
- Google's Soy, which compiles to Java or JavaScript that can produce HTML.
- [Angular templates](https://angular.io/guide/template-overview) which compile to JavaScript, but may in the future compile to `<template>` as well.
- [Lit templates](https://lit.dev/docs/templates/overview/) which compile to `<template>` elements and JavaScript.

Once the page loads with initial content, the framework performs a render or update with the compiled output of the templating with some dynamic data. Some approaches are:
- Virtual DOM: The framework maintains an in-memory representation of the DOM ("virtual DOM") that it updates with JavaScript. Once the virtual DOM has been updated, it is synced with the real DOM.
- Fragment DOM: The framework uses document fragments (`<template>` e.g.) as an intermediate representation of user-authored templates that it then clones and fills in with data. Updates will either generate a new fragment or update the live DOM. Lit and SolidJS use this approach, and Angular, Svelte, and Vue are interested in a similar approach.
- Incremental DOM: The framework uses live DOM as an initial write and/or update target, and caches templating information on the DOM nodes. Soy uses this approach. The difference between this and Fragment DOM is that Incremental DOM does not have intermediate representations of DOM, such as a template, and instead uses JavaScript to directly mutate the live DOM.


Many of these strategies require repeatedly visiting nodes that need to be mutated, or "nodes of interest." For example, immediately after cloning a `<template>` a fragment DOM approach requires walking that template replacing placeholders with additional content. For server-rendered HTML, the base HTML often needs to be enhanced with event listeners or mutated later on in the life cycle of the page.

The current methodology for finding "nodes of interest" is either a full DOM tree walk or DOM queries for classes or ids. These approaches are reasonably performant, but there's an opportunity for the browser to help frameworks locate their nodes of interest more rapidly and with less code.

## Proposal

### Overview

Processing instructions will allow caching nodes of interest during parsing. An imperative API will allow maintaining a live tree of nodes of interest in the DOM. The imperative API is a modification/addition to the original [DOM Parts proposal](https://github.com/rniwa/webcomponents/blob/add-dom-parts-proposal/proposals/DOM-Parts.md).

### Processing Instructions

The improvement here requires there be some way to request that the parser preserve pointers to parts of the DOM, but that once these requests to the parser have been parsed, are not preserved in the DOM and have no influence over it.
Processing instructions are an existing well-known quantity in terms of the spec, so it is a convenient write target for this new feature.

This proposal introduces two new processing instructions. An example:

```html
<html>
  <section>
    <h1 id="name">
      <?child-node-part?><?/child-node-part?>
    </h1>
    Email: <?node-part metadata?><a id="link"></a>
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
interface HTMLPart {
  readonly root?: PartRoot;
  readonly valid: boolean;
  readonly metadata: string[];

  disconnect(): void;
}


```

`root` is a pointer to the `PartRoot` this part is in. `valid` is whether or not the `Part` is valid, `metadata` is additional parsing metadata attached to the `Part`. `disconnect()` removes the Part from its root.

A `NodePart` is constructed for `<?node-part?>` instructions and can also be constructed imperatively.

```ts
class NodePart implements HTMLPart {
  readonly root?: PartRoot;
  readonly valid: boolean;
  readonly metadata: string[];

  readonly node: Node;

  constructor(node: Node, init: {metadata?: string[]} = {}) {}

  disconnect(): void;
}
```

A `ChildNodePart` is constructed for `<?child-node-part?>` instructions and can also be constructed imperatively.

```ts
class ChildNodePart implements HTMLPart, PartRoot {
  readonly root?: PartRoot;
  readonly valid: boolean;
  readonly metadata: string[];

  readonly previousSibling: Node;
  readonly nextSibling: Node;

  constructor(previousSibling: Node, nextSibling: Node, init: {metadata?: string[]} = {}) {}

  children(): Node[] {}

  // All parts in this subtree.
  getParts(): Part[] {}

  // Replaces the children and parts in this range.
  replaceChildren(...nodes: Array<Node|string>) {}

  disconnect(): void;
}
```

`ChildNodePart` is constructed with `previousSibling` and `nextSibling` nodes. The validity of the `ChiildNodePart` is determined from those nodes - they must be ordered, contiguous, and non-overlapping with any other `ChildNodePart` objects.

Invalid `ChildNodePart` objects are still accessible in with `getParts()`, but never have children. 

Unlike `NodePart`, `ChildNodePart` is also a `PartRoot` like a `Document` or `DocumentFragment`. This means that it can contain content and nodes, and can be a `PartRoot` for other parts.


