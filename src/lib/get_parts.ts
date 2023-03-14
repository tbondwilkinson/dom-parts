import { Part } from "./part.js";
import {
  nodePartAttribute,
  childNodePartPreviousSiblingAttribute,
} from "./constants.js";
import { PartValidator } from "./part_validator.js";

export function getParts(root: Document | DocumentFragment | Node[]) {
  return new PartGetter(root).getParts();
}

// Visits all parts.
class PartGetter {
  private parts: Part[] = [];

  private readonly partValidator = new PartValidator();

  constructor(readonly root: Document | DocumentFragment | Node[]) {}

  getParts(): Part[] {
    if (this.root instanceof Array) {
      for (const root of this.root) {
        const walker = root.ownerDocument!.createTreeWalker(root);

        let node: Node | null = walker.currentNode;
        while (node !== null) {
          this.getPartsForNode(node, walker);
          node = walker.nextNode();
        }
      }
    } else {
      const ownerDocument = this.root.ownerDocument ?? this.root;
      const walker = ownerDocument.createTreeWalker(this.root);
      let node: Node | null = null;
      while ((node = walker.nextNode()) !== null) {
        this.getPartsForNode(node, walker);
      }
    }
    return this.parts;
  }

  private getPartsForNode(node: Node, walker: TreeWalker) {
    const nodePart = node[nodePartAttribute];
    if (nodePart) {
      this.parts.push(nodePart);
    }
    const childNodePart = node[childNodePartPreviousSiblingAttribute];
    if (childNodePart) {
      if (this.partValidator.childNodePartValid(childNodePart)) {
        let nextSibling: Node | null = node.nextSibling;
        // Skip walking ChildNodePart since it handles its own parts.
        while (nextSibling && nextSibling !== childNodePart.nextSibling) {
          walker.nextSibling();
          nextSibling = nextSibling.nextSibling;
        }
      }
      this.parts.push(childNodePart);
    }
  }
}
