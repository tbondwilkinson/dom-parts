// Interface for anything that holds parts, such as
interface PartRoot {
  getParts(): Part[];
}

const documentPartAttribute = '__documentnodepart__';
const nodePartAttribute = '__nodepart__';
const childNodePartPreviousSiblingAttribute =
    '__childnodepartprevioussibling__';
const childNodePartNextSiblingAttribute = '__childnodepartnextsibling__';

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

// A validator that is stateful and can cache validation if the DOM is not
// changed.
class PartValidator {
  private readonly validatedChildNodePartParents = new Set<Node>();

  childNodePartValid(childNodePart: ChildNodePart): boolean {
    if (!childNodePart.getParentsValid()) {
      return childNodePart.getCachedValid();
    }
    const parent = childNodePart.previousSibling.parentNode!;
    if (!this.validatedChildNodePartParents.has(parent)) {
      validateChildNodeParts(parent);
      this.validatedChildNodePartParents.add(parent);
    }
    return childNodePart.getCachedValid();
  }
}

// Used to collect parts
class ClonerPartRoot {
  readonly parts: Part[] = [];
}

class ClonerChildNodePartRoot extends ClonerPartRoot {
  constructor(
      readonly parent: ClonerPartRoot, readonly previousSibling: Node,
      readonly metadata: string[]|undefined) {
    super();
  }
}

// Deep clones a Document or DocumentFragment and all its parts.
// Immediately after cloning getCachedParts() will be correct.
class PartCloner {
  private readonly rootClone: Document|DocumentFragment;
  private readonly rootPartClone: DocumentPart;
  private partRoot = new ClonerPartRoot();
  private readonly partValidator = new PartValidator();

  constructor(readonly root: Document|DocumentFragment) {
    if (root instanceof Array) {
      this.rootClone = new DocumentFragment();
      this.rootPartClone =
          new DocumentPart(this.rootClone, this.partRoot.parts);
    } else {
      this.rootClone = root.cloneNode() as Document | DocumentFragment;
      this.rootPartClone =
          new DocumentPart(this.rootClone, this.partRoot.parts);
    }
  }

  clone(): DocumentPart {
    const walker = this.root.ownerDocument!.createTreeWalker(this.root);
    const cloneWalker =
        this.rootClone.ownerDocument!.createTreeWalker(this.rootClone);

    let node: Node|null = walker.nextNode();
    let nodeClone: Node|null = cloneWalker.nextNode();
    while (node !== null && nodeClone !== null) {
      this.visitNode(node, nodeClone);
      nodeClone = walker.nextNode();
      node = walker.nextNode();
    }
    return this.rootPartClone;
  }

  visitNode(node: Node, nodeClone: Node) {
    const nodePart = node[nodePartAttribute];
    if (nodePart) {
      const nodePartClone =
          new NodePart(nodeClone, {metadata: nodePart.metadata});
      this.partRoot.parts.push(nodePartClone);
    }
    const childNodePartStart = node[childNodePartPreviousSiblingAttribute];
    if (childNodePartStart) {
    }
    const childNodePartEnd = node[childNodePartNextSiblingAttribute];
    if (childNodePartStart &&
        this.partValidator.childNodePartValid(childNodePartStart)) {
      this.partRoot = new ClonerChildNodePartRoot(
          this.partRoot, nodeClone, childNodePartStart.metadata);
    }
    if (childNodePartEnd &&
        this.partValidator.childNodePartValid(childNodePartEnd)) {
      const partRoot = this.partRoot as ClonerChildNodePartRoot;
      const childNodePartClone = new ChildNodePart(
          partRoot.previousSibling, nodeClone,
          new InternalChildNodePartInit(
              partRoot.parts, {metadata: partRoot.metadata}));
      this.partRoot = partRoot.parent;
      this.partRoot.parts.push(childNodePartClone);
    }
  }
}

const nodePartRegex = /^\?node-part\s*(?<metadata>.*)\?$/;
const childNodePartRegex = /^\?(?<end>\/)?child-node-part\s*(?<metadata>.*)\?$/;

class ParserPartRoot {
  parts: Part[] = [];
}

class ParserChildNodePartRoot extends ParserPartRoot {
  constructor(
      readonly parent: ParserPartRoot, readonly startComment: Comment,
      readonly metadata?: string) {
    super();
  }
}

class PartParser {
  private partRoot = new ParserPartRoot();

  constructor(private readonly rootNodes: Node[]) {}

  parse(): Part[] {
    for (const root of this.rootNodes) {
      const walker =
          root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_COMMENT);

      let node: Node|null = walker.currentNode;
      while (node !== null) {
        this.parseComment(node as Comment);
        node = walker.nextNode();
      }
    }
    return this.partRoot.parts;
  }

  private parseComment(comment: Comment) {
    const {data} = comment;

    const nodePartMatch = data.match(nodePartRegex);
    if (nodePartMatch) {
      this.parseNodePartComment(comment, nodePartMatch.groups?.['metadata']);
    }
    const childNodePartMatch = data.match(childNodePartRegex);
    if (childNodePartMatch) {
      this.parseChildNodePartComment(
          comment, !!childNodePartMatch.groups?.['end'],
          childNodePartMatch.groups?.['metadata']);
    }
  }

  private parseNodePartComment(
      comment: Comment, parsedMetadata: string|undefined) {
    const nextSibling = comment.nextSibling;
    if (!nextSibling) {
      // Needs a next sibling.
      return;
    }
    const metadata = parsedMetadata ? [parsedMetadata] : [];
    const part = new NodePart(nextSibling, {metadata});
    this.partRoot.parts.push(part);
  }

  private parseChildNodePartComment(
      comment: Comment, end: boolean, parsedMetadata: string|undefined) {
    if (!end) {
      this.partRoot =
          new ParserChildNodePartRoot(this.partRoot, comment, parsedMetadata);
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
          parserPartRoot.startComment, comment,
          new InternalChildNodePartInit([...parserPartRoot.parts], {metadata}));
      this.partRoot = parserPartRoot.parent;
      this.partRoot.parts.push(part);
    }
  }

  private matchParserPartRoot(endComment: Comment): ParserChildNodePartRoot
      |undefined {
    let partRoot = this.partRoot;
    const unmatchedParts: Part[] = [];
    while (partRoot instanceof ParserChildNodePartRoot) {
      if (partRoot.startComment.parentNode === endComment.parentNode) {
        for (const unmatchedPart of unmatchedParts) {
          // If this endComment matches some higher partRoot, collapse all
          // the lower parts into this one, since they were unmatched.
          partRoot.parts.push(unmatchedPart);
        }
        return partRoot;
      }
      // Reached the root.
      if (!partRoot.parent) {
        return;
      }
      unmatchedParts.push(...partRoot.parts);
      partRoot = partRoot.parent;
    }
    return;
  }
}

// Visits all parts.
class PartGetter {
  private roots: Node[];
  private parts: Part[] = [];
  private readonly partValidator = new PartValidator();

  constructor(root: Node|Node[]) {
    this.roots = root instanceof Array ? root : [root];
  }

  getParts(): Part[] {
    for (const root of this.roots) {
      const walker = root.ownerDocument!.createTreeWalker(root);

      let node: Node|null = walker.currentNode;
      while (node !== null) {
        this.getPartsForNode(node, walker);
        node = walker.nextNode();
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
    if (childNodePart && this.partValidator.childNodePartValid(childNodePart)) {
      let nextSibling: Node|null = node.nextSibling;
      // Skip walking ChildNodePart since it handles its own parts.
      while (nextSibling !== childNodePart.nextSibling) {
        walker.nextSibling();
        nextSibling = node.nextSibling;
      }
      this.parts.push(childNodePart);
    }
  }
}

interface PartInit {
  metadata?: string[]|undefined;
}

export interface Part {
  readonly metadata: string[];

  disconnect(): void;
}

class DocumentPart implements Part, PartRoot {
  readonly metadata: string[] = [];

  private cachedParts: Part[];

  constructor(readonly document: Document|DocumentFragment, parts: Part[]) {
    if (document[documentPartAttribute]) {
      throw new Error('Existing DocumentPart for document');
    }

    this.cachedParts = parts;

    // Cache this
    this.document[documentPartAttribute] = this;
  }

  getParts(): Part[] {
    // Dynamic walk of every node in the tree.
    // Very expensive, would not recommend frequently.
    // For users of the polyfill, getCachedParts() returns
    // the result of the last DOM walk if you can guarantee
    // no DOM mutations have invalidated existing parts.
    const getter = new PartGetter(this.document);
    this.cachedParts = getter.getParts();
    return this.cachedParts;
  }

  getCachedParts(): Part[] {
    return this.cachedParts;
  }

  clone(): DocumentPart {
    const cloner = new PartCloner(this.document);
    return cloner.clone();
  }

  disconnect() {
    delete this.document[documentPartAttribute];
  }
}

// Emulates what the browser does on HTML parsing.
export function getDocumentPart(document: Document|DocumentFragment) {
  if (document[documentPartAttribute]) {
    return document[documentPartAttribute];
  }
  const parser = new PartParser([...document.childNodes]);
  return new DocumentPart(document, parser.parse());
}

export class NodePart implements Part {
  readonly metadata: string[];

  constructor(readonly node: Node, init: PartInit = {}) {
    if (node[nodePartAttribute]) {
      throw new Error('Existing NodePart for node');
    }
    if (!node.parentNode) {
      throw new Error('Node must be in the DOM');
    }

    this.metadata = init.metadata ?? [];

    node[nodePartAttribute] = this;
  }

  disconnect() {
    delete this.node[nodePartAttribute];
  }
}

class InternalChildNodePartInit implements PartInit {
  metadata?: string[]|undefined;

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

function validateChildNodeParts(parent: Node, {prospectiveChildNodePart}: {
  prospectiveChildNodePart?: ProspectiveChildNodePart,
} = {}) {
  // ChildNodeParts that already have a settled validation status.
  const validatedChildNodeParts = new Set<ChildNodePart>();
  // The current stack of ChildNodePart.
  const childNodePartStack: ChildNodePart[] = [];

  function setValid(childNodePart: ChildNodePart, valid: boolean) {
    childNodePart.setCachedValid(valid);
    validatedChildNodeParts.add(childNodePart);
  }

  function validateStart(node: Node) {
    if (prospectiveChildNodePart?.previousSibling === node &&
        prospectiveChildNodePart?.valid === undefined) {
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
        prospectiveChildNodePart.valid = prospectiveChildNodePart.parent ===
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

export class ChildNodePart implements Part {
  readonly metadata: string[];
  get valid(): boolean {
    if (!this.getParentsValid()) {
      this.cachedValid = false
    } else {
      validateChildNodeParts(this.previousSibling.parentNode!);
    }
    return this.cachedValid;
  }
  readonly previousSibling: Node;
  readonly nextSibling: Node;

  private cachedParts: Part[] = [];
  private cachedValid: boolean = true;

  constructor(previousSibling: Node, nextSibling: Node, init: PartInit = {}) {
    if (!previousSibling.parentNode || !nextSibling.parentNode) {
      throw new Error('Siblings must be in the DOM');
    }
    if (previousSibling[childNodePartPreviousSiblingAttribute]) {
      throw new Error('Existing ChildNodePart for previousSibling');
    }
    if (nextSibling[childNodePartNextSiblingAttribute]) {
      throw new Error('Existing ChildNodePart for nextSibling');
    }
    if (previousSibling.parentNode !== nextSibling.parentNode) {
      // TODO(twilkinson): Handle previouSibling or nextSibling being the
      // parent of the other.
      throw new Error('Previous or next sibling do not match parent');
    }
    const prospectiveChildNodePart:
        ProspectiveChildNodePart = {previousSibling, nextSibling};
    validateChildNodeParts(
        previousSibling.parentNode, {prospectiveChildNodePart})
    if (!prospectiveChildNodePart.valid) {
      throw new Error('Overlapping ChildNodePart');
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
    const getter = new PartGetter(this.getChildren());
    this.cachedParts = getter.getParts();
    return this.cachedParts;
  }

  getCachedParts(): Part[] {
    return this.cachedParts;
  }

  setCachedValid(valid: boolean) {
    this.cachedValid = valid;
  }

  getCachedValid(): boolean {
    return this.cachedValid;
  }

  getParentsValid(): boolean {
    return !!this.previousSibling.parentNode &&
        this.previousSibling.parentNode === this.nextSibling.parentNode;
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
