import { Part } from "./part.js";

// Interface for anything that holds parts, such as Document, DocumentFragment, or ChildNodePart.
export interface PartRoot {
  getParts(): Part[];
}
