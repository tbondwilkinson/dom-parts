interface PartRoot {
  getInitialParts(): Part[];
}

interface DynamicPartRoot extends PartRoot {
  // Adds a part. Does basic checking.
  addPart(part: Part): void;

  // Removes a part.
  removePart(part: Part): void;

  // Gets the parts, both dynamic and parsed.
  getParts(): Part[];

  // Clones the root with the dynamic parts. Does checking to
  // make sure that the parts and DOM are correct.
  cloneWithParts(): DynamicPartRoot;
}

interface PartInit {
  metadata: string[];
}

class Part {
  readonly metadata: string[];

  constructor({metadata}: PartInit) {
    this.metadata = metadata;
  }
}

class NodePart extends Part {
  constructor(readonly node: Node, init: PartInit) {
    super(init);
  }
}

class ChildNodePart extends Part implements DynamicPartRoot {
  // Equivalent to parentElement.children with only the children
  // in this range. This is not live, and if the underlying
  // DOM changes, this will not update.
  readonly parent: Node|null;
  children: Node[];

  private initialParts: Part[];
  private parts = new Map<Node, Set<Part>>;

  constructor(
      parent: Node|null, children: Node[], initialParts: Part[],
      init: PartInit) {
    super(init);
    this.parent = parent;
    this.children = [];
    this.initialParts = initialParts;
    this.replace(children, initialParts);
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
    if (root === null) {
      throw new Error('Part is not connected to a parent');
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
            throw new Error('Child is already part of another ChildNodePart');
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
    const clonedChildren: Node[] = [];
    const clonedParts: NodePart[] = [];
    for (const child of this.children) {
      const [clonedChild, clonedParts] = this.clone(child, seenParts);
      clonedChildren.push(clonedChild);
      clonedParts.push(...clonedParts);
    }
    return new ChildNodePart(
        null, clonedChildren, clonedParts, {metadata: this.metadata});
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
