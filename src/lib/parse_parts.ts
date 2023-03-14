import { Part } from "./part.js";
import { ChildNodePart, InternalChildNodePartInit } from "./child_node_part.js";
import { NodePart } from "./node_part.js";

const nodePartRegex = /^\?node-part\s*(?<metadata>.*)\?$/;
const childNodePartRegex = /^\?(?<end>\/)?child-node-part\s*(?<metadata>.*)\?$/;

export function parseParts(document: Document | DocumentFragment) {
  return new PartParser(document).parse();
}

class ParserPartRoot {
  parts: Part[] = [];
}

class ParserChildNodePartRoot extends ParserPartRoot {
  constructor(
    readonly parent: ParserPartRoot,
    readonly startComment: Comment,
    readonly metadata?: string
  ) {
    super();
  }
}

class PartParser {
  private partRoot = new ParserPartRoot();

  constructor(private readonly root: Document | DocumentFragment) {}

  parse(): Part[] {
    const ownerDocument = this.root.ownerDocument ?? this.root;
    const walker = ownerDocument.createTreeWalker(
      this.root,
      NodeFilter.SHOW_COMMENT
    );

    let node: Node | null = null;
    while ((node = walker.nextNode()) !== null) {
      this.parseComment(node as Comment);
    }
    while (this.partRoot instanceof ParserChildNodePartRoot) {
      this.partRoot = this.partRoot.parent;
    }
    return this.partRoot.parts;
  }

  private parseComment(comment: Comment) {
    if (!comment.data) {
      return;
    }
    const { data } = comment;

    const nodePartMatch = data.match(nodePartRegex);
    if (nodePartMatch) {
      this.parseNodePartComment(comment, nodePartMatch.groups?.["metadata"]);
    }
    const childNodePartMatch = data.match(childNodePartRegex);
    if (childNodePartMatch) {
      this.parseChildNodePartComment(
        comment,
        !!childNodePartMatch.groups?.["end"],
        childNodePartMatch.groups?.["metadata"]
      );
    }
  }

  private parseNodePartComment(
    comment: Comment,
    parsedMetadata: string | undefined
  ) {
    const nextSibling = comment.nextSibling;
    if (!nextSibling) {
      // Needs a next sibling.
      return;
    }
    const metadata = parsedMetadata ? [parsedMetadata] : [];
    const part = new NodePart(nextSibling, { metadata });
    this.partRoot.parts.push(part);
  }

  private parseChildNodePartComment(
    comment: Comment,
    end: boolean,
    parsedMetadata: string | undefined
  ) {
    if (!end) {
      this.partRoot = new ParserChildNodePartRoot(
        this.partRoot,
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
        new InternalChildNodePartInit([...parserPartRoot.parts], { metadata })
      );
      this.partRoot = parserPartRoot.parent;
      this.partRoot.parts.push(part);
    }
  }

  private matchParserPartRoot(
    endComment: Comment
  ): ParserChildNodePartRoot | undefined {
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
