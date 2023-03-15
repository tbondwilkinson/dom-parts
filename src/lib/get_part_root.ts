import {
  childNodePartOwnedChildAttribute,
  documentPartAttribute,
} from "./constants.js";
import { PartValidator } from "./part_validator.js";
import { PartRoot } from "./part_root.js";

// Walks up the DOM looking for a PartRoot.
export function getPartRoot(node: Node): PartRoot | undefined {
  const partValidator = new PartValidator();
  let currentNode: Node | null = node;
  while (currentNode !== null) {
    if (currentNode.parentNode) {
      partValidator.refreshChildNodeParts(currentNode.parentNode);
    }
    if (currentNode[childNodePartOwnedChildAttribute]) {
      return currentNode[childNodePartOwnedChildAttribute];
    }
    if (
      currentNode.nodeType === Node.DOCUMENT_NODE ||
      (currentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
        (currentNode as Document | DocumentFragment)[documentPartAttribute])
    ) {
      return (currentNode as Document | DocumentFragment)[
        documentPartAttribute
      ];
    }
    currentNode = currentNode.parentNode;
  }
  return undefined;
}
