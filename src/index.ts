interface PartRoot {
  getParts(): Part[];
  clone(): PartRoot;
}

const documentPartAttribute = "__documentnodepart__";
const nodePartAttribute = "__nodepart__";
const childNodePartPreviousSiblingAttribute =
  "__childnodepartprevioussibling__";
const childNodePartNextSiblingAttribute = "__childnodepartnextsibling__";

declare global {
  interface Document {
    [documentPartAttribute]?: DocumentPart;
  }

  interface DocumentFragment {
    [documentPartAttribute]?: DocumentPart;
  }

  interface Node {
    // One per node
    [nodePartAttribute]?: NodePart;
    // One per previous sibling node
    [childNodePartPreviousSiblingAttribute]?: ChildNodePart;
    // One per next sibling node
    [childNodePartNextSiblingAttribute]?: ChildNodePart;
  }
}

const nodePartRegex = /^\?node-part\s*(?<metadata>.*)\?$/;
const childNodePartRegex = /^\?(?<end>\/)?child-node-part\s*(?<metadata>.*)\?$/;

class ClonerPartRoot {
  parts: Part[] = [];
}

class ClonerChildNodePartRoot extends ClonerPartRoot {
  parent: ParserPartRoot;

  startNode: Node;
  metadata?: string;

  constructor(parent: ParserPartRoot, startNode: Node, metadata?: string) {
    super();

    this.parent = parent;
    this.startNode = startNode;
  }
}

class PartCloner {
  private readonly fragment = new DocumentFragment();
  private readonly baseClonerRartRoot = new ClonerPartRoot();
  private clonerPartRoot = this.baseClonerRartRoot;

  constructor(private readonly rootNodes: Node[]) {}

  clone(): DocumentPart {
    for (const root of this.rootNodes) {
      const walker = root.ownerDocument!.createTreeWalker(root);

      let node: Node | null = walker.currentNode;
      if (
        (node.nodeType === Node.DOCUMENT_NODE ||
          node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) &&
        this.rootNodes.length === 1 &&
        this.rootNodes[0] === node
      ) {
        this.cloneDocumentNode(node as Document | DocumentFragment);
        node = walker.nextNode();
      } else {
        throw new Error(
          "Only one top-level Document or DocumentFragment allowed."
        );
      }
      while (node !== null) {
        this.cloneNode(node);
        node = walker.nextNode();
      }
    }
    const documentPart = this.fragment[documentPartAttribute];
    if (documentPart) {
      return documentPart;
    }
    return new DocumentPart(
      this.fragment,
      new InternalDocumentPartInit(this.baseClonerRartRoot.parts)
    );
  }

  cloneDocumentNode(node: Document | DocumentFragment) {
    const documentPart = node[documentPartAttribute];
    new DocumentPart(
      this.fragment,
      new InternalDocumentPartInit(this.baseClonerRartRoot.parts, {
        metadata: documentPart?.metadata,
      })
    );
  }

  cloneNode(node: Node) {
    const nodeClone = node.cloneNode();
    const nodePart = node[nodePartAttribute];
    if (nodePart) {
      new NodePart(node, { metadata: nodePart.metadata });
    }
    const childNodePart = node[childNodePartPreviousSiblingAttribute];
    if (childNodePart) {
      childNodePart.clone();
      this.clonerPartRoot = new ClonerChildNodePartRoot(
        this.clonerPartRoot,
        node
      );
    }
  }
}

class ParserPartRoot {
  parts: Part[] = [];
}

class ParserChildNodePartRoot extends ParserPartRoot {
  parent: ParserPartRoot;

  startComment: Comment;
  metadata?: string;

  constructor(
    parent: ParserPartRoot,
    startComment: Comment,
    metadata?: string
  ) {
    super();

    this.parent = parent;
    this.startComment = startComment;
  }
}

// Visits all parts.
class PartVisitor {
  private readonly baseParserPartRoot = new ParserPartRoot();
  private parserPartRoot = this.baseParserPartRoot;
  private readonly parseComments: boolean;

  constructor(
    private readonly rootNodes: Node[],
    { parseComments }: { parseComments?: boolean } = {}
  ) {
    this.parseComments = parseComments ?? false;
  }

  visit(): Part[] {
    for (const root of this.rootNodes) {
      const walker = root.ownerDocument!.createTreeWalker(root);

      let node: Node | null = walker.currentNode;
      while (node !== null) {
        if (this.parseComments && node instanceof Comment) {
          this.visitComment(node);
        } else {
          this.visitNode(node, walker);
        }
        node = walker.nextNode();
      }
    }
    return [...this.baseParserPartRoot.parts];
  }

  private visitComment(comment: Comment) {
    const { data } = comment;

    const nodePartMatch = data.match(nodePartRegex);
    if (nodePartMatch) {
      this.visitPartComment(comment, nodePartMatch.groups?.["metadata"]);
    }
    const childNodePartMatch = data.match(childNodePartRegex);
    if (childNodePartMatch) {
      this.visitChildNodePartComment(
        comment,
        !!childNodePartMatch.groups?.["end"],
        childNodePartMatch.groups?.["metadata"]
      );
    }
  }

  private visitNode(node: Node, walker: TreeWalker) {
    const nodePart = node[nodePartAttribute];
    if (nodePart) {
      this.parserPartRoot.parts.push(nodePart);
    }
    const childNodePart = node[childNodePartPreviousSiblingAttribute];
    if (childNodePart) {
      let nextSibling: Node | null = node.nextSibling;
      // Skip walking ChildNodePart since it handles its own parts.
      while (nextSibling !== childNodePart.nextSibling) {
        walker.nextSibling();
        nextSibling = node.nextSibling;
      }
      this.parserPartRoot.parts.push(childNodePart);
    }
  }

  private visitPartComment(
    comment: Comment,
    parsedMetadata: string | undefined
  ) {
    const nextSibling = comment.nextSibling;
    if (!nextSibling) {
      // Needs a next sibling.
      return;
    }
    const metadata = parsedMetadata ? [parsedMetadata] : [];
    // Since its the nextSibling, visitNode will add it.
    const part = new NodePart(nextSibling, { metadata });
  }

  private visitChildNodePartComment(
    comment: Comment,
    end: boolean,
    parsedMetadata: string | undefined
  ) {
    if (!end) {
      this.parserPartRoot = new ParserChildNodePartRoot(
        this.parserPartRoot,
        comment,
        parsedMetadata
      );
    } else {
      const parserPartRoot = this.matchParserPartRoot(comment);
      if (!parserPartRoot) {
        // end comment matches no existing part root.
        return;
      }
      const metadata: string[] = [];
      if (parserPartRoot.metadata !== undefined) {
        metadata.push(parserPartRoot.metadata);
      }
      if (parsedMetadata !== undefined) {
        metadata.push(parsedMetadata);
      }
      const part = new ChildNodePart(
        parserPartRoot.startComment,
        comment,
        new ParserChildNodePartInit([...parserPartRoot.parts], { metadata })
      );
      this.parserPartRoot = parserPartRoot.parent;
      this.parserPartRoot.parts.push(part);
    }
  }

  private matchParserPartRoot(
    endComment: Comment
  ): ParserChildNodePartRoot | undefined {
    let parserPartRoot = this.parserPartRoot;
    const unmatchedParts: Part[] = [];
    while (parserPartRoot instanceof ParserChildNodePartRoot) {
      if (parserPartRoot.startComment.parentNode === endComment.parentNode) {
        for (const unmatchedPart of unmatchedParts) {
          // If this endComment matches some higher ParserPartRoot, collapse all
          // the lower parts into this one, since they were unmatched.
          parserPartRoot.parts.push(unmatchedPart);
        }
        return parserPartRoot;
      }
      // Reached the root.
      if (!parserPartRoot.parent) {
        return;
      }
      unmatchedParts.push(...parserPartRoot.parts);
      parserPartRoot = parserPartRoot.parent;
    }
    return;
  }
}

interface PartInit {
  metadata?: string[];
}

export interface Part {
  readonly metadata: string[];
  readonly isConnected: boolean;

  disconnect(): void;
}

class InternalDocumentPartInit implements PartInit {
  metadata?: string[];

  constructor(readonly parts: Part[], init: PartInit = {}) {
    this.metadata = init.metadata;
  }
}

export class DocumentPart implements Part, PartRoot {
  readonly metadata: string[] = [];
  get isConnected() {
    return this.root.isConnected;
  }

  private readonly root: Document | DocumentFragment;
  private cachedParts: Part[];

  constructor(document: Document | DocumentFragment, init: PartInit = {}) {
    if (document[documentPartAttribute]) {
      throw new Error("Existing DocumentPart for document");
    }
    this.metadata = init.metadata ?? [];

    this.root = document;

    if (init instanceof InternalDocumentPartInit) {
      // Parsing happened elsewhere.
      this.cachedParts = init.parts;
    } else {
      const visitor = new PartVisitor([this.root], { parseComments: true });
      // This populates the Element cache for parts.
      this.cachedParts = visitor.visit();
    }
    // Cache this
    this.root[documentPartAttribute] = this;
  }

  getParts(): Part[] {
    // Dynamic walk of every node in the tree.
    // Very expensive, would not recommend frequently.
    // For users of the polyfill, getCachedParts() returns
    // the result of the last DOM walk if you can guarantee
    // no DOM mutations have invalidated existing parts.
    const visitor = new PartVisitor([this.root]);
    return visitor.visit();
  }

  getCachedParts(): Part[] {
    return this.cachedParts;
  }

  clone(): DocumentPart {
    // TODO(twilkinson)
    return this;
  }

  disconnect() {
    delete this.root[documentPartAttribute];
  }
}

export class NodePart implements Part {
  readonly metadata: string[];
  get isConnected() {
    return this.connected;
  }

  private connected = true;

  constructor(readonly node: Node, init: PartInit = {}) {
    if (node[nodePartAttribute]) {
      throw new Error("Existing NodePart for node");
    }
    if (!node.parentNode) {
      throw new Error("Node must be in the DOM");
    }

    this.metadata = init.metadata ?? [];

    node[nodePartAttribute] = this;
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === this.node) {
            this.disconnect();
            mutationObserver.disconnect();
          }
        }
      }
    });
    mutationObserver.observe(node.parentNode!, { childList: true });
  }

  disconnect() {
    this.connected = false;
    delete this.node[nodePartAttribute];
  }
}

class ParserChildNodePartInit implements PartInit {
  metadata?: string[];

  constructor(readonly parts: Part[], init: PartInit) {
    this.metadata = init.metadata;
  }
}

function validate(previousSibling: Node, nextSibling: Node): boolean {
  const parent = previousSibling.parentNode!;
  let sibling: Node | null = previousSibling.nextSibling;

  const seenPreviousNodes = new Set();
  const lookNextNodes = new Set();

  while (sibling !== nextSibling && sibling !== null) {
    let childNodePart = sibling[childNodePartPreviousSiblingAttribute];
    if (childNodePart) {
      seenPreviousNodes.add(sibling);
      lookNextNodes.add(childNodePart.nextSibling);
    }
    childNodePart = sibling[childNodePartNextSiblingAttribute];
    if (childNodePart) {
      lookNextNodes.delete(sibling);
      if (!seenPreviousNodes.has(childNodePart.previousSibling)) {
        // There's a nextSibling that has no previousSibling.
        return false;
      }
    }
  }
  if (sibling === null) {
    // nextSibling is not contiguous with previousSibling.
    return false;
  }
  // There's a previousSibling with no nextSibling.
  return lookNextNodes.size === 0;
}

export class ChildNodePart implements Part, PartRoot {
  readonly metadata: string[];
  get isConnected(): boolean {
    return this.connected;
  }
  readonly previousSibling: Node;
  readonly nextSibling: Node;

  private cachedParts: Part[];
  private connected: boolean = true;

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
      // TODO(twilkinson): Handle previouSibling or nextSibling being the parent of the other.
      throw new Error("Previous or next sibling do not match parent");
    }
    if (!validate(previousSibling, nextSibling)) {
      throw new Error("Overlapping ChildNodePart");
    }

    this.previousSibling = previousSibling;
    this.nextSibling = nextSibling;

    this.metadata = init.metadata ?? [];

    if (init instanceof ParserChildNodePartInit) {
      this.cachedParts = init.parts;
    } else {
      this.cachedParts = new PartVisitor(this.getRoots()).visit();
    }
    previousSibling[childNodePartPreviousSiblingAttribute] = this;
    nextSibling[childNodePartNextSiblingAttribute] = this;
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === this.previousSibling || node === this.nextSibling) {
            this.disconnect();
            mutationObserver.disconnect();
          }
        }
      }
    });
    mutationObserver.observe(previousSibling.parentNode!, { childList: true });
  }

  disconnect() {
    this.connected = false;
    delete this.previousSibling[childNodePartPreviousSiblingAttribute];
    delete this.nextSibling[childNodePartPreviousSiblingAttribute];
  }

  getParts(): Part[] {
    if (!this.isConnected) {
      return [];
    }
    // Dynamic walk of every node in the tree.
    // Very expensive, would not recommend frequently.
    // For users of the polyfill, getCachedParts() returns
    // the result of the last DOM walk if you can guarantee
    // no DOM mutations have invalidated parts.
    const parts = new PartVisitor(this.getRoots()).visit();
    this.cachedParts = parts;
    return parts;
  }

  getCachedParts(): Part[] {
    return this.cachedParts;
  }

  clone(): ChildNodePart {
    // TODO(twilkinson)
    return this;
  }

  private getRoots(): Node[] {
    const roots: Node[] = [];
    let sibling: Node = this.previousSibling;
    while ((sibling = sibling.nextSibling!) !== this.nextSibling) {
      roots.push(sibling);
    }
    return roots;
  }
}
