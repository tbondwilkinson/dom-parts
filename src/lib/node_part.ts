import { Part, PartInit } from "./part.js";
import { nodePartAttribute } from "./constants.js";
import { PartRoot } from "./part_root.js";
import { getPartRoot } from "./get_part_root.js";

// Cache the NodePart on the Node.
declare global {
  interface Node {
    [nodePartAttribute]?: NodePart;
  }
}

// A NodePart that marks a specific Node.
export class NodePart implements Part {
  get partRoot() {
    if (!this.connected) {
      return undefined;
    }
    this.cachedPartRoot = getPartRoot(this.node);
    return this.cachedPartRoot;
  }

  readonly metadata: string[];
  get valid() {
    return this.connected;
  }

  private connected = true;
  private cachedPartRoot: PartRoot | undefined = undefined;

  constructor(readonly node: Node, init: PartInit = {}) {
    if (node[nodePartAttribute]) {
      throw new Error("Existing NodePart for node");
    }
    if (!node.parentNode) {
      throw new Error("Node must be in the DOM");
    }

    this.metadata = init.metadata ?? [];

    node[nodePartAttribute] = this;
  }

  getCachedPartRoot() {
    return this.cachedPartRoot;
  }

  disconnect() {
    this.connected = false;
    delete this.node[nodePartAttribute];
  }
}
