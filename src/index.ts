import {captureRejectionSymbol} from 'events';
import {chdir} from 'process';

interface PartRoot {
  getParts(): Part[];
  cloneWithParts(): PartRoot;
}

const elementPartAttribute = '__part__';
const elementChildNodePartParentAttribute = '__childnodepartparent__';
const elementChildNodePartPreviousSiblingAttribute =
    '__childnodepartprevioussibling__';
const elementChildNodePartNextSiblingAttribute = '__childnodepartnextsibling__';
const elementPartRootAttribute = '__partroot__';

declare global {
  interface Node {
    // One per element
    [elementPartAttribute]?: Part;
    // One per previous sibling element
    [elementChildNodePartPreviousSiblingAttribute]?: Part;
    // One per next sibling element
    [elementChildNodePartNextSiblingAttribute]?: Part;
    // One per element
    [elementPartRootAttribute]?: PartRoot;
  }
}

function getRootNodes(root: Document|DocumentFragment|ChildNodePart): Node[] {
  if (root instanceof ChildNodePart) {
    return root.children();
  }
  if (root instanceof Node) {
    if (root.nodeType === Node.DOCUMENT_NODE) {
      return [(root as Document).getRootNode()];
    }
    if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return [root];
    }
  }
  return [];
}

function getPartRoot(node: Node): PartRoot|null {
  let currentNode: Node|null = node;
  while (currentNode !== null) {
    if (currentNode[elementPartRootAttribute]) {
      return currentNode[elementPartRootAttribute];
    }
    if (currentNode.nodeType === Node.DOCUMENT_NODE) {
      return new DocumentPartRootPonyfill(currentNode as Document);
    }
    if (currentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return new DocumentPartRootPonyfill(currentNode as DocumentFragment);
    }
    currentNode = currentNode.parentNode;
  }
  return null;
}


// Wraps a Document, DocumentFragment, or ChildNodePart.
class PartRootPonyfill implements PartRoot {
  private parts = new Set<Part>();

  constructor(root: Document|DocumentFragment|ChildNodePart) {
    const partVisitor = new PartVisitor(this, root);
    this.parts = partVisitor.visit();
  }

  getParts(): Part[] {
    return [];
  }
  cloneWithParts(): PartRoot {
    return this;
  }
}

class DocumentPartRootPonyfill extends PartRootPonyfill {
  constructor(root: Document|DocumentFragment) {
    super(root);
    root[elementPartRootAttribute] = this;
  }
}

const nodePartRegex = /^\?node-part\s*(?<metadata>.*)\?$/;
const childNodePartRegex = /^\?(?<end>\/)?child-node-part\s*(?<metadata>.*)\?$/;

interface OpenChildNodePart {
  startComment: Comment;
  parts: Set<Part>;
}

// Visits all parts and
class PartVisitor {
  private visited = false;
  private parts = new Set<Part>();
  private openChildNodePartStack: OpenChildNodePart[] = [];

  constructor(
      private readonly partRoot: PartRootPonyfill,
      private readonly wrappedPartRoot: Document|DocumentFragment|ChildNodePart,
      private readonly parseComments = true) {}

  visit(): Set<Part> {
    if (this.visited) {
      return this.parts;
    }
    this.visited = true;
    for (const root of getRootNodes(this.wrappedPartRoot)) {
      const walker = root.ownerDocument!.createTreeWalker(root);

      let node: Node|null;
      while ((node = walker.nextNode()) !== null) {
        if (node instanceof Comment) {
          this.visitComment(node);
        }
      }
    }
    return this.parts;
  }

  private visitComment(comment: Comment) {
    const {data} = comment;

    const nodePartMatch = data.match(nodePartRegex);
    if (nodePartMatch) {
      this.visitPartComment(comment, nodePartMatch.groups?.['metadata']);
    }
    const childNodePartMatch = data.match(childNodePartRegex);
    if (childNodePartMatch) {
      this.visitChildNodePartComment(
          comment, !!childNodePartMatch.groups?.['end'],
          childNodePartMatch.groups?.['metadata']);
    }
    if (data === '?node-part?') {
      const part = new Part(this.partRoot, node.nextSibling)
      parts.push(new Part(node));
    } else if (data === '?child-node-part?') {
      openChildPartStack.push({startNode: node, outerParts: parts});
      parts = [];
    } else if (data === '?/child-node-part?') {
      const childPartData = openChildPartStack.pop();
      if (childPartData === undefined) {
        throw new Error('Unexpected end child part');
      }
      const childPart = new ChildPart(childPartData.startNode, node, parts);
      (parts = childPartData.outerParts).push(childPart);
    }
  }

  private visitPartComment(comment: Comment, parsedMetadata: string|undefined) {
    const nextSibling = comment.nextSibling;
    if (!nextSibling) {
      // Needs a next sibling.
      return;
    }
    nextSibling[elementPartRootAttribute] = const metadata =
        parsedMetadata ? [parsedMetadata] : [];
    const part = new NodePart(nextSibling, {metadata});
    this.addPart(part);
  }

  private visitChildNodePartComment(
      comment: Comment, end: boolean, parsedMetadata: string|undefined) {
    if (!end) {
      this.openChildNodePartStack.push(
          {startComment: comment, parts: new Set()});
    } else {
      const openChildNodePart = this.matchChildNodePart(comment);
      if (!openChildNodePart) {
        // Emulating parsing behavior, no error.
        return;
      }
      const part = new ChildNodePart(
          this.partRoot,
          comment.parentNode,
      );
      this.addPart();
    }
  }

  private getPartRoot(): PartRoot {
    if (this.openChildNodePartStack.length) {
      return this.openChildNodePartStack[this.openChildNodePartStack.length];
    }
  }

  private addPart(part: Part) {
    if (this.openChildNodePartStack.length) {
      return this.openChildNodePartStack[this.openChildNodePartStack.length]
          .parts.add(part);
    }
    return this.parts.add(part);
  }

  private matchChildNodePart(endComment: Comment): OpenChildNodePart|undefined {
    for (let i = this.openChildNodePartStack.length - 1; i >= 0; i--) {
      const childNodePart = this.openChildNodePartStack[i];
      if (childNodePart.startComment.parentNode === endComment.parentNode) {
        this.openChildNodePartStack.splice(i);
        return childNodePart;
      }
    }
    return undefined;
  }
}

interface PartInit {
  metadata?: string[];
}

export interface Part {
  readonly root: PartRoot;
  readonly metadata: string[];
  readonly valid: boolean;
}

export class NodePart implements Part {
  get root() {
    return getPartRoot(this.node)!;
  }

  readonly metadata: string[]


  constructor(readonly node: Node, init: PartInit = {}) {
    return
  }
}

class ParsedChildNodePart extends Part implements PartRoot {
  constructor(
      readonly previousSibling: Node|null, readonly nextSibling: Node|null,
      parts: Part[], init?: PartInit) {
    super()
  }

  getParts(): Part[] {
    return [];
  }
  cloneWithParts(): PartRoot {
    return this;
  }
}

export class ChildNodePart extends Part implements PartRoot {
  children(): Node[] {
    return [];
  }


  constructor(
      previousSibling: Node|null, nextSibling: Node|null, init?: PartInit) {
    super(init);
    this.parent = parent;
    this.children = [];
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    for (let i = startIndex; i < endIndex && i < parent.childNodes.length;
         i++) {
      this.children.push(parent.childNodes[i]);
    }

    this.initialParts = initialParts;
    for (const part of this.initialParts) {
      this.addPart(part);
    }
  }

  getInitialParts(): Part[] {
    return [...this.initialParts];
  }

  // Adds a part. Does checking to make sure the NodePart is valid.
  addPart(part: Part) {
    let root;
    if (part instanceof NodePart) {
      root = part.node;
    } else if (part instanceof ChildNodePart) {
      root = part.parent;
    } else {
      return;
    }
    // Make sure part is in this part, and no other.
    if (!this.contains(root)) {
      throw new Error('Part not contained in this ChildNodePart');
    }
    const existingParts = this.parts.get(root) ?? new Set();
    if (existingParts.size) {
      const childNodeParts =
          [...existingParts].filter((part) => part instanceof ChildNodePart) as
          ChildNodePart[];
      for (const childNodePart of childNodeParts) {
        if (childNodePart.contains(root)) {
          throw new Error('Part contained in child ChildNodePart');
        }
      }
      const isChildNodePart = part instanceof ChildNodePart;
      if (!isChildNodePart) {
        if (childNodeParts.length < existingParts.size) {
          throw new Error('Already have a NodePart for this element');
        }
      } else {
        const existingChildren =
            new Set(childNodeParts.map((part) => part.children).flat());
        for (const child of part.children) {
          if (existingChildren.has(child)) {
            throw new Error(
                'ChildNodePart overlaps with another ChildNodePart');
          }
        }
      }
    }
    this.parts.set(root, existingParts);
  }

  // Removes a part.
  removePart(part: Part) {
    let root;
    if (part instanceof NodePart) {
      root = part.node;
    } else if (part instanceof ChildNodePart) {
      root = part.parent;
    } else {
      return;
    }
    if (root === null) {
      throw new Error('Part is not connected to a parent');
    }
    const existingParts = this.parts.get(root);
    existingParts?.delete(part);
  }

  // Gets the parts, both dynamic and parsed.
  getParts(): Part[] {
    const parts: Part[] = [];
    for (const [, partsForNode] of this.parts) {
      parts.push(...partsForNode);
    }
    return parts;
  }

  // Utility method to see if a node is contained in this ChildNodePart.
  private contains(node: Node): boolean {
    for (const child of this.children) {
      if (child.contains(node)) {
        return true;
      }
    }
    return false;
  }

  // Clones the part with the dynamic parts. Does checking to
  // make sure that the parts and DOM are correct.
  cloneWithParts(): ChildNodePart {
    if (this.parent) {
      const currentChildren = this.parent.childNodes;
      const seenChildren = new Set(this.children);
      for (const currentChild of currentChildren) {
        if (seenChildren.has(currentChild)) {
          seenChildren.delete(currentChild);
        } else if (
            seenChildren.size > 0 && seenChildren.size < this.children.length) {
          // Some unknown sibling, throw.
          throw new Error(
              'Encountered child that should be contained in this ChildNodePart');
        }
      }
      if (seenChildren.size !== 0) {
        throw new Error('Children are not currently contained within node');
      }
    } else {
      for (const child of this.children) {
        if (child.parentNode !== null) {
          throw new Error('All children should have null parents');
        }
      }
    }
    const seenParts = new Map(this.parts);
    const documentFragment = new DocumentFragment();
    const clonedChildren: Node[] = [];
    const clonedParts: NodePart[] = [];
    for (const child of this.children) {
      const [clonedChild, clonedParts] = this.clone(child, seenParts);
      documentFragment.appendChild(clonedChild);
      clonedChildren.push(clonedChild);
      clonedParts.push(...clonedParts);
    }
    return new ChildNodePart(
        documentFragment, 0, Infinity, clonedParts, {metadata: this.metadata});
  }

  syncChildren(startIndex = this.startIndex, endIndex = this.endIndex) {}

  syncIndexes(children = this.children) {
    let firstChildOffset = ;
    for (let i = 0;
         i < this.parent.childNodes.length && i < this.children.length; i++) {
      const currentChild = this.parent.childNodes[i];
      if (currentChild === children[i - firstChildOffset]) {
      }
    }
  }

  private clone(node: Node, seenParts: Map<Node, Set<Part>>):
      [root: Node, parts: Part[]] {
    let clonedNode = node.cloneNode();
    const clonedParts: Part[] = [];
    const clonedChildrenFromParts = new Map<Node, Node>();
    const parts = seenParts.get(node);
    // First iterate over all the parts.
    if (parts) {
      for (const part of parts) {
        if (part instanceof NodePart) {
          // Node parts are cloned and added.
          clonedParts.push(new NodePart(clonedNode, {metadata: part.metadata}));
        }
        if (part instanceof ChildNodePart) {
          // ChildNodeParts are cloned via their method. The children will be
          // added to the parent clone later.
          const partClone = part.cloneWithParts();
          for (let i = 0; i < part.children.length; i++) {
            clonedChildrenFromParts.set(
                part.children[i], partClone.children[i]);
          }
          clonedParts.push(partClone);
        }
      }
    }
    seenParts.delete(node);
    for (const child of node.childNodes) {
      // Either get the cached clones from part cloning, or do the recursive
      // clone.
      const clonedChildFromParts = clonedChildrenFromParts.get(child);
      if (clonedChildFromParts) {
        clonedNode.appendChild(clonedChildFromParts)
      } else {
        const [clonedChild, clonedChildParts] = this.clone(child, seenParts);
        clonedNode.appendChild(clonedChild);
        clonedParts.push(...clonedChildParts);
      }
    }
    return [clonedNode, clonedParts];
  }

  // Replaces the children and parts in this range.
  // Throws if the parts are not attached to the children tree.
  replace(children: Array<Node|string>, parts: Part[]) {
    this.children = [];
    this.parts = new Map();
    for (const child of children) {
      if (child instanceof Node && child.parentNode &&
          child.parentNode !== this.parent) {
        throw new Error('The child is not a child');
      } else {
      }
    }
    this.children = children.map((child) => {
      if (child instanceof Node) {
        return child;
      }
      return new Text(child);
    });
    for (const part of this.initialParts) {
      // Does checking to make sure the parts are correct.
      this.addPart(part);
    }
  }
}
