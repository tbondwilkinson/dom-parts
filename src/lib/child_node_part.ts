import { Part, PartInit } from "./part.js";
import { getParts } from "./get_parts.js";
import {
  childNodePartPreviousSiblingAttribute,
  childNodePartNextSiblingAttribute,
  childNodePartOwnedChildAttribute,
} from "./constants.js";
import { getPartRoot } from "./get_part_root.js";
import { PartRoot } from "./part_root.js";

declare global {
  interface Node {
    // Cache ChildNodePart on previous sibling node.
    [childNodePartPreviousSiblingAttribute]?: ChildNodePart;
    // Cache ChildNodePart on next sibling node.
    [childNodePartNextSiblingAttribute]?: ChildNodePart;
    // Cache ChildNOdePart on children.
    [childNodePartOwnedChildAttribute]?: ChildNodePart;
  }
}

// A ChildNodePart wraps all nodes between a previousSibling and a nextSibling.
export class ChildNodePart implements Part, PartRoot {
  get partRoot() {
    if (!this.connected) {
      return undefined;
    }
    this.cachedPartRoot = getPartRoot(this.previousSibling);
    return this.cachedPartRoot;
  }

  // Metadata from parsing or from construction.
  readonly metadata: string[];
  // Whether the ChildNodePart has previousSibling and nextSibling that form a valid range.
  get valid(): boolean {
    if (!this.getParentsValid()) {
      this.cachedValid = false;
    } else {
      refreshChildNodeParts(this.previousSibling.parentNode!);
    }
    return this.cachedValid;
  }
  // Previous sibling starting this range.
  readonly previousSibling: Node;
  // Next sibling ending this range.
  readonly nextSibling: Node;

  private connected = false;
  // Cached PartRoot, invalid if the DOM has changed.
  private cachedPartRoot: PartRoot | undefined = undefined;
  // Cached parts, invalid if the DOM has changed.
  private cachedParts: Part[] = [];
  // Cached valid, invalid if the DOM has changed.
  private cachedValid: boolean = true;
  // Cached owned children, invalid if the DOM has changed.
  private cachedOwnedChildren: Node[] = [];

  constructor(previousSibling: Node, nextSibling: Node, init: PartInit = {}) {
    if (!previousSibling.parentNode || !nextSibling.parentNode) {
      throw new Error("Siblings must be in the DOM");
    }
    if (previousSibling[childNodePartPreviousSiblingAttribute]) {
      throw new Error("Existing ChildNodePart for previousSibling");
    }
    if (nextSibling[childNodePartNextSiblingAttribute]) {
      throw new Error("Existing ChildNodePart for nextSibling");
    }
    if (previousSibling.parentNode !== nextSibling.parentNode) {
      throw new Error("Previous or next sibling do not match parent");
    }
    // Visits all children of parentNode.
    refreshChildNodeParts(previousSibling.parentNode);
    const parentChildNodePart =
      previousSibling[childNodePartOwnedChildAttribute];
    if (parentChildNodePart !== nextSibling[childNodePartOwnedChildAttribute]) {
      throw new Error("Overlapping ChildNodePart");
    }
    const ownedChildren = [];
    let child = previousSibling.nextSibling;
    while (child && child !== nextSibling) {
      if (child[childNodePartOwnedChildAttribute] === parentChildNodePart) {
        ownedChildren.push(child);
      }
      child = child.nextSibling;
    }
    if (!child) {
      throw new Error("previousSibling must precede nextSibling");
    }

    this.previousSibling = previousSibling;
    this.nextSibling = nextSibling;

    this.metadata = init.metadata ?? [];

    if (init instanceof InternalChildNodePartInit) {
      this.cachedParts = init.parts;
    }
    this.connected = true;
    previousSibling[childNodePartPreviousSiblingAttribute] = this;
    nextSibling[childNodePartNextSiblingAttribute] = this;
    this.setCachedOwnedChildren(ownedChildren);
    if (ownedChildren.length && parentChildNodePart) {
      const parentCachedOwnedChildren =
        parentChildNodePart.getCachedOwnedChildren();
      const parentIndex = parentCachedOwnedChildren.findIndex(
        (child) => previousSibling === child
      );
      parentCachedOwnedChildren.splice(parentIndex + 1, ownedChildren.length);
    }
  }

  disconnect() {
    this.connected = false;
    delete this.previousSibling[childNodePartPreviousSiblingAttribute];
    delete this.nextSibling[childNodePartPreviousSiblingAttribute];
    for (const child of this.cachedOwnedChildren) {
      if (child[childNodePartOwnedChildAttribute] === this) {
        delete child[childNodePartOwnedChildAttribute];
      }
    }
  }

  getParts(): Part[] {
    if (!this.valid) {
      return [];
    }
    // Dynamic walk of every node in the tree.
    // Very expensive, would not recommend frequently.
    // For users of the polyfill, getCachedParts() returns
    // the result of the last DOM walk if you can guarantee
    // no DOM mutations have invalidated parts.
    this.cachedParts = getParts(this.cachedOwnedChildren);
    return this.cachedParts;
  }

  getChildren(): Node[] {
    if (!this.valid) {
      return [];
    }
    return this.getDomChildren();
  }

  getOwnedChildren(): Node[] {
    if (!this.valid) {
      return [];
    }
    // After a valid call, cachedOwnedChildren is correct.
    return this.cachedOwnedChildren;
  }

  replaceChildren(...children: Array<Node | string>) {
    if (!this.valid) {
      throw new Error("ChildNodePart is invalid");
    }
    const parent = this.previousSibling.parentNode!;
    for (const child of this.getDomChildren()) {
      parent.removeChild(child);
    }
    for (const child of children) {
      if (typeof child === "string") {
        parent.insertBefore(new Text(child), this.nextSibling);
      } else {
        parent.insertBefore(child, this.nextSibling);
      }
    }
  }

  getCachedPartRoot(): PartRoot | undefined {
    return this.cachedPartRoot;
  }

  getCachedParts(): Part[] {
    return this.cachedParts;
  }

  setCachedParts(parts: Part[]) {
    this.cachedParts = parts;
  }

  setCachedValid(valid: boolean) {
    this.cachedValid = valid;
  }

  getCachedValid(): boolean {
    return this.cachedValid;
  }

  getCachedOwnedChildren(): Node[] {
    return this.cachedOwnedChildren;
  }

  setCachedOwnedChildren(children: Node[]) {
    for (const child of this.cachedOwnedChildren) {
      if (child[childNodePartOwnedChildAttribute] === this) {
        delete child[childNodePartOwnedChildAttribute];
      }
    }
    this.cachedOwnedChildren = children;
    for (const child of this.cachedOwnedChildren) {
      child[childNodePartOwnedChildAttribute] = this;
    }
  }

  private getDomChildren(): Node[] {
    const children: Node[] = [];
    for (
      let child = this.previousSibling.nextSibling;
      child && child !== this.nextSibling;
      child = child.nextSibling
    ) {
      children.push(child);
    }
    return children;
  }

  getParentsValid(): boolean {
    return (
      !!this.previousSibling.parentNode &&
      this.previousSibling.parentNode === this.nextSibling.parentNode
    );
  }
}

export class InternalChildNodePartInit implements PartInit {
  metadata?: string[] | undefined;

  constructor(readonly parts: Part[], init: PartInit) {
    this.metadata = init.metadata;
  }
}

interface ChildNodePartStackNode {
  childNodePart: ChildNodePart;
  children: Node[];
}

export function refreshChildNodeParts(parent: Node) {
  // ChildNodeParts that already have a settled validation status.
  const validatedChildNodeParts = new Set<ChildNodePart>();
  // The current stack of ChildNodePart.
  const childNodePartStack: ChildNodePartStackNode[] = [];

  function setValid(
    childNodePart: ChildNodePart,
    valid: boolean,
    children: Node[] = []
  ) {
    childNodePart.setCachedValid(valid);
    childNodePart.setCachedOwnedChildren(children);
    validatedChildNodeParts.add(childNodePart);
  }

  function validateStart(node: Node) {
    const childNodePart = node[childNodePartPreviousSiblingAttribute];
    if (!childNodePart || validatedChildNodeParts.has(childNodePart)) {
      return;
    }
    if (childNodePart.nextSibling.parentNode !== parent) {
      // Parents mismatch.
      setValid(childNodePart, false, []);
      return;
    }
    childNodePartStack.push({ childNodePart, children: [] });
  }

  function validateEnd(node: Node) {
    const childNodePart = node[childNodePartNextSiblingAttribute];
    if (!childNodePart || validatedChildNodeParts.has(childNodePart)) {
      return;
    }
    const index = childNodePartStack.findIndex(
      (stackNode) => stackNode.childNodePart === childNodePart
    );
    if (index === -1) {
      // Not on the stack.
      setValid(childNodePart, false);
      return;
    }
    const removed = childNodePartStack.splice(index);
    if (removed.length === 1) {
      // ChildNodePart is the top-level, set valid.
      setValid(removed[0].childNodePart, true, removed[0].children);
      return;
    }
    for (const { childNodePart, children } of removed) {
      childNodePartStack[childNodePartStack.length - 1]?.children.push(
        ...children
      );
      // Overlapping ChildNodeParts.
      setValid(childNodePart, false);
    }
  }

  for (const node of parent.childNodes) {
    validateEnd(node);
    childNodePartStack[childNodePartStack.length - 1]?.children.push(node);
    validateStart(node);
  }
}
