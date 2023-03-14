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
  private skipNodes = new Set<Node>();

  private readonly partValidator = new PartValidator();

  constructor(readonly root: Document | DocumentFragment | Node[]) {}

  getParts(): Part[] {
    if (this.root instanceof Array) {
      for (const root of this.root) {
        const walker = root.ownerDocument!.createTreeWalker(root);
        this.getPartsFromWalker(walker);
      }
    } else {
      const ownerDocument = this.root.ownerDocument ?? this.root;
      const walker = ownerDocument.createTreeWalker(this.root);
      this.getPartsFromWalker(walker);
    }
    return this.parts;
  }

  private getPartsFromWalker(walker: TreeWalker) {
    let node: Node | null = walker.currentNode;
    while (node != null) {
      if (this.skipNodes.has(node)) {
        walker.nextSibling();
      }
      this.getPartsForNode(node);
      node = walker.nextNode();
    }
  }

  private getPartsForNode(node: Node) {
    const nodePart = node[nodePartAttribute];
    if (nodePart) {
      this.parts.push(nodePart);
    }
    const childNodePart = node[childNodePartPreviousSiblingAttribute];
    if (childNodePart) {
      if (this.partValidator.childNodePartValid(childNodePart)) {
        let skipNode: Node | null = node.nextSibling;
        // Skip walking roots owned by another ChildNodePart.
        while (skipNode && skipNode !== childNodePart.nextSibling) {
          this.skipNodes.add(skipNode);
          skipNode = skipNode.nextSibling;
        }
      }
      this.parts.push(childNodePart);
    }
  }
}
