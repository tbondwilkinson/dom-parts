# Differences from the original [DOM Parts Proposal][original-proposal-link]

[original-proposal-link]: https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md

# Additions

## Declarative HTML Syntax

The biggest difference is the introduction of a processing instructions as a mechanism for declaratively creating `Part` objects. The declarative syntax supports server-side rendered HTML and side-steps the question of whether a declarative syntax should be added to `<template>` to support `Part` object creation.

## PartRoot

This proposal introduces the concept of a `PartRoot` that has a `getParts()` method, and defines the `Document`, `DocumentFragment`, and `ChildNodePart` as `PartRoot` objects.

Making `Document` and `DocumentFragment` be `PartRoot` objects was necessary because something needed to provide the declaratively constructed parts to the application.

`ChildNodePart` being a `PartRoot` made sense once it was important that parts be able to nest and form a tree of parts.

## Browser updates part list and validity

Because there is now a `getParts()` method that retrieves `Part` objects, the browser has to take a more active role in keeping that list live. Removing DOM nodes with `Part` objects needs to remove them from the `getParts()` list or else risk a memory leak. Similarly, the browser will now keep track of the nodes that form a `ChildNodePart` range, and will invalidate the `ChildNodePart` when either node is changed in such a way that it no longer forms a valid range. As part of this, a new `valid` attribute was added to `Part`, as well as a `disconnect` method that removes the `Part` from part lists and invalidates it.

With nested `Part` objects, invalidating or removing a parent `PartRoot` such as a `ChildNodePart` must also add the `Part` objects to the parent `PartRoot`.

## Metadata

`Part` objects also have metadata, which is mostly for declaratively defined `Part` objects to pass information to imperative API consumers. Metadata is a list because you may have metadata for both the start and end processing instructions for `ChildNodePart`.

## Cloning

The original proposal had a hybrid `cloneNode` and `importNode` cloning method. This proposal instead allows cloning only at the `DocumentPart`, and it does a deep clone of all nodes and creates new parts.

## `ChildNodePart.prototype.replaceChildren`

One new mutation convenience method is `replaceChildren`, which replaces the entire contents of a `ChildNodePart` with new children. This method is possible to do with a userland solution, but is a nice convenience method.

# Simplifications

To simplify the original proposal, some parts and features have been removed.

## `.value` and `.commit()`

In the original proposal every `Part` had a value that could be set to update the piece of DOM it wrapped. After updating a `Part` with `.value`, a `.commit()` method could be called to update the piece of DOM.

This was removed, instead users will have to directly update the `DOM` using existing APIs. This simplifies the API and avoids having to think about a new DOM mutation API at the same time.

## `AttributePart`

`AttributePart` is no longer a supported Part. Instead, users can use a `NodePart` and update attributes directly using DOM APIs.

## `ChildNodePart`

`ChildNodePart` no longer takes a `parent` node. Instead, it is only valid if both `previousSibling` and `nextSibling` have the same parent. This means that a `ChildNodePart` can be moved around together and would remain valid.
