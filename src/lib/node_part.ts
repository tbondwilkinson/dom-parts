import { Part, PartInit } from "./part.js";
import { nodePartAttribute } from "./constants.js";

// Cache the NodePart on the Node.
declare global {
  interface Node {
    [nodePartAttribute]?: NodePart;
  }
}

// A NodePart that marks a specific Node.
export class NodePart implements Part {
  readonly metadata: string[];
  readonly valid: boolean = true;

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

  disconnect() {
    delete this.node[nodePartAttribute];
  }
}
