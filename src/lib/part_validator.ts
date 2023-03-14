import { ChildNodePart, validateChildNodeParts } from "./child_node_part.js";

// A validator that is stateful and can cache validation if the caller knows the DOM is not changing.
export class PartValidator {
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
