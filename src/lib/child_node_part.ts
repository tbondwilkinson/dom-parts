import { Part, PartInit } from "./part.js";
import { getParts } from "./get_parts.js";
import {
  childNodePartPreviousSiblingAttribute,
  childNodePartNextSiblingAttribute,
} from "./constants.js";

declare global {
  interface Node {
    // Cache ChildNodePart on previous sibling node.
    [childNodePartPreviousSiblingAttribute]?: ChildNodePart;
    // Cache ChildNodePart on next sibling node.
    [childNodePartNextSiblingAttribute]?: ChildNodePart;
  }
}

// A ChildNodePart wraps all nodes between a previousSibling and a nextSibling.
export class ChildNodePart implements Part {
  // Metadata from parsing or from construction.
  readonly metadata: string[];
  // Whether the ChildNodePart has previousSibling and nextSibling that form a valid range.
  get valid(): boolean {
    if (!this.getParentsValid()) {
      this.cachedValid = false;
    } else {
      validateChildNodeParts(this.previousSibling.parentNode!);
    }
    return this.cachedValid;
  }
  // Previous sibling starting this range.
  readonly previousSibling: Node;
  // Next sibling ending this range.
  readonly nextSibling: Node;

  // Cached parts, invalid if the DOM has changed.
  private cachedParts: Part[] = [];
  // Cached valid, invalid if the DOM has changed.
  private cachedValid: boolean = true;

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
    const prospectiveChildNodePart: ProspectiveChildNodePart = {
      previousSibling,
      nextSibling,
    };
    // Visits all children of parentNode.
    validateChildNodeParts(previousSibling.parentNode, {
      prospectiveChildNodePart,
    });
    if (!prospectiveChildNodePart.valid) {
      throw new Error("Overlapping ChildNodePart");
    }

    this.previousSibling = previousSibling;
    this.nextSibling = nextSibling;

    this.metadata = init.metadata ?? [];

    if (init instanceof InternalChildNodePartInit) {
      this.cachedParts = init.parts;
    }
    previousSibling[childNodePartPreviousSiblingAttribute] = this;
    nextSibling[childNodePartNextSiblingAttribute] = this;
  }

  disconnect() {
    delete this.previousSibling[childNodePartPreviousSiblingAttribute];
    delete this.nextSibling[childNodePartPreviousSiblingAttribute];
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
    this.cachedParts = getParts(this.getChildren());
    return this.cachedParts;
  }

  replaceChildren(...children: Array<Node | string>) {
    if (!this.valid) {
      throw new Error("ChildNodePart is invalid");
    }
    const parent = this.previousSibling.parentNode!;
    let sibling = this.previousSibling;
    while (sibling && sibling !== this.nextSibling) {
      parent.removeChild(sibling);
    }
    for (const child of children) {
      if (typeof child === "string") {
        parent.insertBefore(new Text(child), this.nextSibling);
      } else {
        parent.insertBefore(child, this.nextSibling);
      }
    }
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

  getParentsValid(): boolean {
    return (
      !!this.previousSibling.parentNode &&
      this.previousSibling.parentNode === this.nextSibling.parentNode
    );
  }

  private getChildren(): Node[] {
    const roots: Node[] = [];
    let sibling: Node = this.previousSibling;
    while ((sibling = sibling.nextSibling!) !== this.nextSibling) {
      roots.push(sibling);
    }
    return roots;
  }
}

export class InternalChildNodePartInit implements PartInit {
  metadata?: string[] | undefined;

  constructor(readonly parts: Part[], init: PartInit) {
    this.metadata = init.metadata;
  }
}

interface ProspectiveChildNodePart {
  previousSibling: Node;
  nextSibling: Node;
  inOrder?: boolean;
  parent?: ChildNodePart;
  valid?: boolean;
}

export function validateChildNodeParts(
  parent: Node,
  {
    prospectiveChildNodePart,
  }: {
    prospectiveChildNodePart?: ProspectiveChildNodePart;
  } = {}
) {
  // ChildNodeParts that already have a settled validation status.
  const validatedChildNodeParts = new Set<ChildNodePart>();
  // The current stack of ChildNodePart.
  const childNodePartStack: ChildNodePart[] = [];

  function setValid(childNodePart: ChildNodePart, valid: boolean) {
    childNodePart.setCachedValid(valid);
    validatedChildNodeParts.add(childNodePart);
  }

  function validateStart(node: Node) {
    if (
      prospectiveChildNodePart?.previousSibling === node &&
      prospectiveChildNodePart?.valid === undefined
    ) {
      // Start occurs first, store parent to make sure its the same when we
      // find the end.
      prospectiveChildNodePart.inOrder = true;
      prospectiveChildNodePart.parent =
        childNodePartStack[childNodePartStack.length - 1];
    }
    const childNodePart = node[childNodePartPreviousSiblingAttribute];
    if (!childNodePart || validatedChildNodeParts.has(childNodePart)) {
      return;
    }
    if (childNodePart.nextSibling.parentNode !== parent) {
      // Parents mismatch.
      setValid(childNodePart, false);
      return;
    }
    childNodePartStack.push(childNodePart);
  }

  function validateEnd(node: Node) {
    if (prospectiveChildNodePart?.nextSibling === node) {
      if (prospectiveChildNodePart.inOrder === undefined) {
        // Did not see start.
        prospectiveChildNodePart.inOrder = false;
        prospectiveChildNodePart.valid = false;
      } else {
        // Saw start, check whether parent is the same.
        prospectiveChildNodePart.valid =
          prospectiveChildNodePart.parent ===
          childNodePartStack[childNodePartStack.length - 1];
      }
    }
    const childNodePart = node[childNodePartNextSiblingAttribute];
    if (!childNodePart || validatedChildNodeParts.has(childNodePart)) {
      return;
    }
    const index = childNodePartStack.findIndex((cnp) => cnp === childNodePart);
    if (index === -1) {
      // Not on the stack.
      setValid(childNodePart, false);
      return;
    }
    const removed = childNodePartStack.splice(index);
    if (removed.length === 1) {
      // ChildNodePart is the top-level, set valid.
      setValid(childNodePart, true);
      return;
    }
    for (const childNodePart of removed) {
      // Overlapping ChildNodeParts.
      setValid(childNodePart, false);
    }
  }

  for (const node of parent.childNodes) {
    validateEnd(node);
    validateStart(node);
  }
}
