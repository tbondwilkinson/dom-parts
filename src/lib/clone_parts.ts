import { Part } from "./part.js";
import { DocumentPart } from "./document_part.js";
import { NodePart } from "./node_part.js";
import { ChildNodePart, InternalChildNodePartInit } from "./child_node_part.js";
import { PartValidator } from "./part_validator.js";
import {
  nodePartAttribute,
  childNodePartNextSiblingAttribute,
  childNodePartPreviousSiblingAttribute,
} from "./constants.js";

export function cloneParts(document: Document | DocumentFragment) {
  return new PartCloner(document).clone();
}

// Used to collect parts
class ClonerPartRoot {
  readonly parts: Part[] = [];
}

class ClonerChildNodePartRoot extends ClonerPartRoot {
  constructor(
    readonly parent: ClonerPartRoot,
    readonly previousSibling: Node,
    readonly metadata: string[] | undefined
  ) {
    super();
  }
}

// Deep clones a Document or DocumentFragment and all its parts.
// Immediately after cloning getCachedParts() will be correct.
export class PartCloner {
  private partRoot = new ClonerPartRoot();
  private readonly partValidator = new PartValidator();

  constructor(readonly root: Document | DocumentFragment) {}

  clone(): DocumentPart {
    const rootClone = this.root.cloneNode(true) as Document | DocumentFragment;
    const rootPartClone = new DocumentPart(rootClone, this.partRoot.parts);
    const ownerDocument = this.root.ownerDocument ?? this.root;
    const walker = ownerDocument.createTreeWalker(this.root);
    const cloneOwnerDocument = rootClone.ownerDocument ?? rootClone;
    const cloneWalker = cloneOwnerDocument.createTreeWalker(rootClone);

    let node: Node | null = walker.nextNode();
    let nodeClone: Node | null = cloneWalker.nextNode();
    while (node !== null && nodeClone !== null) {
      this.visitNodeAndClone(node, nodeClone);
      node = walker.nextNode();
      nodeClone = cloneWalker.nextNode();
    }
    return rootPartClone;
  }

  visitNodeAndClone(node: Node, nodeClone: Node) {
    const nodePart = node[nodePartAttribute];
    if (nodePart) {
      const nodePartClone = new NodePart(nodeClone, {
        metadata: nodePart.metadata,
      });
      this.partRoot.parts.push(nodePartClone);
    }
    const childNodePartStart = node[childNodePartPreviousSiblingAttribute];
    const childNodePartEnd = node[childNodePartNextSiblingAttribute];
    if (
      childNodePartStart &&
      this.partValidator.childNodePartValid(childNodePartStart)
    ) {
      this.partRoot = new ClonerChildNodePartRoot(
        this.partRoot,
        nodeClone,
        childNodePartStart.metadata
      );
    }
    if (
      childNodePartEnd &&
      this.partValidator.childNodePartValid(childNodePartEnd)
    ) {
      const partRoot = this.partRoot as ClonerChildNodePartRoot;
      const childNodePartClone = new ChildNodePart(
        partRoot.previousSibling,
        nodeClone,
        new InternalChildNodePartInit(partRoot.parts, {
          metadata: partRoot.metadata,
        })
      );
      this.partRoot = partRoot.parent;
      this.partRoot.parts.push(childNodePartClone);
    }
  }
}
