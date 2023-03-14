import { Part } from "./part.js";
import { PartRoot } from "./part_root.js";
import { documentPartAttribute } from "./constants.js";
import { getParts } from "./get_parts.js";
import { cloneParts } from "./clone_parts.js";
import { parseParts } from "./parse_parts.js";

declare global {
  interface Document {
    [documentPartAttribute]?: DocumentPart;
  }

  interface DocumentFragment {
    [documentPartAttribute]?: DocumentPart;
  }
}

// Emulates what the browser does on HTML parsing.
export function getDocumentPart(document: Document | DocumentFragment) {
  if (document[documentPartAttribute]) {
    return document[documentPartAttribute];
  }
  return new DocumentPart(document, parseParts(document));
}

export class DocumentPart implements PartRoot {
  private cachedParts: Part[];

  constructor(readonly document: Document | DocumentFragment, parts: Part[]) {
    if (document[documentPartAttribute]) {
      throw new Error("Existing DocumentPart for document");
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
    this.cachedParts = getParts(this.document);
    return this.cachedParts;
  }

  getCachedParts(): Part[] {
    return this.cachedParts;
  }

  clone(): DocumentPart {
    return cloneParts(this.document);
  }

  disconnect() {
    delete this.document[documentPartAttribute];
  }
}
