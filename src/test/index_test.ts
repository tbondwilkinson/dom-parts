import { expect } from "@esm-bundle/chai";

import {
  ChildNodePart,
  NodePart,
  getDocumentPart,
  DocumentPart,
} from "../index.js";

describe("DOM parts", () => {
  function createDom() {
    const parent = document.createElement("div");
    parent.id = "parent";
    const children = addChildren(parent);
    return { parent, children };
  }
  function addChildren(
    parent: Node,
    childName: string = "child",
    childNum = 5
  ) {
    const children = [];
    for (let i = 0; i < childNum; i++) {
      const child = document.createElement("div");
      child.id = `${childName}-${i}`;
      parent.appendChild(child);
      children.push(child);
    }
    return children;
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("NodePart", () => {
    it("constructs", () => {
      const node = document.createElement("div");
      document.body.appendChild(node);
      const metadata = ["metadata"];
      const nodePart = new NodePart(node, { metadata: metadata });
      expect(nodePart.node).to.equal(node);
      expect(nodePart.metadata).to.equal(metadata);
      expect(nodePart.valid).to.be.true;
    });
  });

  describe("ChildNodePart", () => {
    it("constructs", () => {
      const { children } = createDom();

      const metadata = ["metadata"];
      const childNodePart = new ChildNodePart(children[0], children[4], {
        metadata,
      });
      expect(childNodePart.previousSibling).to.equal(children[0]);
      expect(childNodePart.nextSibling).to.equal(children[4]);
      expect(childNodePart.metadata).to.equal(metadata);
      expect(childNodePart.getCachedValid()).to.be.true;
      expect(childNodePart.valid).to.be.true;
      expect(childNodePart.getCachedParts()).to.deep.equal([]);
      expect(childNodePart.getParts()).to.deep.equal([]);
    });

    describe("errors on", () => {
      it("disconnected nodes", () => {
        const previousSibling = document.createElement("div");
        const nextSibling = document.createElement("div");

        expect(() => {
          new ChildNodePart(previousSibling, nextSibling);
        }).to.throw();
      });

      it("disconnected previousSibling", () => {
        const previousSibling = document.createElement("div");
        const nextSibling = document.createElement("div");
        document.body.appendChild(nextSibling);

        expect(() => {
          new ChildNodePart(previousSibling, nextSibling);
        }).to.throw();
      });

      it("disconnected nextSibling", () => {
        const previousSibling = document.createElement("div");
        document.body.appendChild(previousSibling);
        const nextSibling = document.createElement("div");
        document.body.appendChild(previousSibling);

        expect(() => {
          new ChildNodePart(previousSibling, nextSibling);
        }).to.throw();
      });

      it("siblings with different parents", () => {
        const parent = document.createElement("div");
        const previousSibling = document.createElement("div");
        parent.appendChild(previousSibling);
        const nextSibling = document.createElement("div");
        document.body.appendChild(nextSibling);

        expect(() => {
          new ChildNodePart(previousSibling, nextSibling);
        }).to.throw();
      });

      it("reversed siblings", () => {
        const { children } = createDom();

        expect(() => {
          new ChildNodePart(children[4], children[0]);
        }).to.throw();
      });

      it("existing ChildNodePart", () => {
        const { children } = createDom();

        new ChildNodePart(children[0], children[4]);

        expect(() => {
          new ChildNodePart(children[0], children[4]);
        }).to.throw();
      });

      it("existing previousSibling ChildNodePart", () => {
        const { children } = createDom();

        new ChildNodePart(children[0], children[4]);

        expect(() => {
          new ChildNodePart(children[0], children[1]);
        }).to.throw();
      });

      it("existing nextSibling ChildNodePart", () => {
        const { children } = createDom();

        new ChildNodePart(children[0], children[4]);

        expect(() => {
          new ChildNodePart(children[4], children[4]);
        }).to.throw();
      });

      it("overlapping ChildNodeParts", () => {
        const { children } = createDom();

        const childNodePart = new ChildNodePart(children[0], children[2]);

        expect(() => {
          new ChildNodePart(children[1], children[3]);
        }).to.throw();

        expect(childNodePart.getCachedValid()).to.be.true;
        expect(childNodePart.valid).to.be.true;
      });

      it("left overlapping ChildNodeParts", () => {
        const { children } = createDom();

        const childNodePart = new ChildNodePart(children[2], children[4]);

        expect(() => {
          new ChildNodePart(children[1], children[3]);
        }).to.throw();

        expect(childNodePart.getCachedValid()).to.be.true;
        expect(childNodePart.valid).to.be.true;
      });

      describe("DOM mutations", () => {
        it("previousSibling removed", () => {
          const { children } = createDom();

          const childNodePart = new ChildNodePart(children[0], children[4]);

          children[0].remove();
          expect(childNodePart.getCachedValid()).to.be.true;
          expect(childNodePart.valid).to.be.false;
          expect(childNodePart.getCachedValid()).to.be.false;
        });

        it("nextSibling removed", () => {
          const { children } = createDom();

          const childNodePart = new ChildNodePart(children[0], children[4]);

          children[4].remove();
          expect(childNodePart.getCachedValid()).to.be.true;
          expect(childNodePart.valid).to.be.false;
          expect(childNodePart.getCachedValid()).to.be.false;
        });

        it("both removed", () => {
          const { children } = createDom();

          const childNodePart = new ChildNodePart(children[0], children[4]);

          children[0].remove();
          children[4].remove();
          expect(childNodePart.getCachedValid()).to.be.true;
          expect(childNodePart.valid).to.be.false;
          expect(childNodePart.getCachedValid()).to.be.false;
        });

        it("moved to overlap ChildNodePart ", () => {
          const { children } = createDom();

          const childNodePart1 = new ChildNodePart(children[0], children[2]);
          const childNodePart2 = new ChildNodePart(children[3], children[4]);

          expect(childNodePart1.getCachedValid()).to.be.true;
          expect(childNodePart2.getCachedValid()).to.be.true;
          expect(childNodePart1.valid).to.be.true;
          expect(childNodePart2.valid).to.be.true;

          children[3].remove();
          children[0].insertAdjacentElement("afterend", children[3]);

          expect(childNodePart1.getCachedValid()).to.be.true;
          expect(childNodePart2.getCachedValid()).to.be.true;
          expect(childNodePart1.valid).to.be.false;
          expect(childNodePart2.valid).to.be.false;
          expect(childNodePart1.getCachedValid()).to.be.false;
          expect(childNodePart2.getCachedValid()).to.be.false;
        });
      });
    });

    it("sibling ChildNodeParts", () => {
      const { children } = createDom();

      const childNodePart1 = new ChildNodePart(children[0], children[2]);
      const childNodePart2 = new ChildNodePart(children[2], children[4]);

      expect(childNodePart1.valid).to.be.true;
      expect(childNodePart2.valid).to.be.true;
    });

    describe("gets parts", () => {
      it("nested", () => {
        const { children } = createDom();
        const nestedChildren = addChildren(children[2], "nested-child", 3);

        const childNodePart = new ChildNodePart(children[0], children[4]);

        expect(childNodePart.getCachedParts()).to.deep.equal([]);
        expect(childNodePart.getParts()).to.deep.equal([]);

        const nodePart1 = new NodePart(nestedChildren[0]);
        const nodePart2 = new NodePart(nestedChildren[1]);
        const nodePart3 = new NodePart(nestedChildren[2]);

        expect(childNodePart.getCachedParts()).to.deep.equal([]);
        expect(childNodePart.getParts()).to.deep.equal([
          nodePart1,
          nodePart2,
          nodePart3,
        ]);

        nodePart1.disconnect();
        expect(childNodePart.getCachedParts()).to.deep.equal([
          nodePart1,
          nodePart2,
          nodePart3,
        ]);
        expect(childNodePart.getParts()).to.deep.equal([nodePart2, nodePart3]);
        nodePart3.disconnect();
        expect(childNodePart.getCachedParts()).to.deep.equal([
          nodePart2,
          nodePart3,
        ]);
        expect(childNodePart.getParts()).to.deep.equal([nodePart2]);
        nodePart2.disconnect();
        expect(childNodePart.getCachedParts()).to.deep.equal([nodePart2]);
        expect(childNodePart.getParts()).to.deep.equal([]);
        expect(childNodePart.getCachedParts()).to.deep.equal([]);
      });

      it("deeply nested", () => {
        const { children } = createDom();
        const nestedChildren = addChildren(children[2], "nested-child", 3);
        const deeplyNestedChildren = addChildren(
          nestedChildren[1],
          "deeply-nested-child",
          3
        );

        const childNodePart = new ChildNodePart(children[0], children[4]);

        expect(childNodePart.getCachedParts()).to.deep.equal([]);
        expect(childNodePart.getParts()).to.deep.equal([]);

        const nestedChildNodePart = new ChildNodePart(
          nestedChildren[0],
          nestedChildren[2]
        );
        expect(childNodePart.getCachedParts()).to.deep.equal([]);
        expect(childNodePart.getParts()).to.deep.equal([nestedChildNodePart]);
        expect(childNodePart.getCachedParts()).to.deep.equal([
          nestedChildNodePart,
        ]);
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([]);

        const nodePart1 = new NodePart(deeplyNestedChildren[0]);
        const nodePart2 = new NodePart(deeplyNestedChildren[1]);
        const nodePart3 = new NodePart(deeplyNestedChildren[2]);

        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([
          nodePart1,
          nodePart2,
          nodePart3,
        ]);

        nodePart1.disconnect();
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([
          nodePart1,
          nodePart2,
          nodePart3,
        ]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([
          nodePart2,
          nodePart3,
        ]);
        nodePart3.disconnect();
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([
          nodePart2,
          nodePart3,
        ]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([nodePart2]);
        nodePart2.disconnect();
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([nodePart2]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([]);
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([]);
      });

      it("preserves invalid", () => {
        const { children } = createDom();
        const nestedChildren = addChildren(children[2], "nested-child", 3);

        const childNodePart = new ChildNodePart(children[0], children[4]);

        const nestedChildNodePart = new ChildNodePart(
          nestedChildren[0],
          nestedChildren[2]
        );

        expect(nestedChildNodePart.valid).to.be.true;
        expect(childNodePart.getParts()).to.deep.equal([nestedChildNodePart]);

        nestedChildren[2].remove();
        expect(nestedChildNodePart.valid).to.be.false;
        expect(childNodePart.getParts()).to.deep.equal([nestedChildNodePart]);
      });
    });
  });

  describe("getDocumentPart", () => {
    let documentPart: DocumentPart | undefined;

    afterEach(() => {
      documentPart?.disconnect();
    });

    it("constructs", () => {
      documentPart = getDocumentPart(document);
      expect(documentPart.document).to.equal(document);
      expect(documentPart).to.equal(getDocumentPart(document));
    });

    describe("parses comments", () => {
      it("node part", () => {
        document.body.innerHTML =
          "<?node-part node-metadata?><div id='node'></div>";

        const node = document.getElementById("node")!;

        documentPart = getDocumentPart(document);
        const parts = documentPart.getCachedParts();
        expect(parts.length).to.equal(1);
        const part = parts[0] as NodePart;
        expect(part).to.be.instanceOf(NodePart);
        expect(part.node).to.equal(node);
        expect(part.valid).to.be.true;
        expect(part.metadata).to.deep.equal(["node-metadata"]);
      });

      it("node part no metadata", () => {
        document.body.innerHTML = "<?node-part?><div id='node'></div>";

        const node = document.getElementById("node")!;

        documentPart = getDocumentPart(document);
        const parts = documentPart.getCachedParts();
        expect(parts.length).to.equal(1);
        const part = parts[0] as NodePart;
        expect(part).to.be.instanceOf(NodePart);
        expect(part.node).to.equal(node);
        expect(part.valid).to.be.true;
        expect(part.metadata).to.deep.equal([]);
      });

      it("child node part", () => {
        document.body.innerHTML =
          "<?child-node-part child-node-previous1-metadata?>" +
          "<div id='child1'></div>" +
          "<?node-part child2-node-metadata?><div id='child2'></div>" +
          "<?/child-node-part child-node-next1-metadata?>";

        const child1El = document.getElementById("child1")!;
        const child2El = document.getElementById("child2")!;

        documentPart = getDocumentPart(document);
        const parts = documentPart.getCachedParts();
        expect(parts.length).to.equal(1);
        const part = parts[0] as ChildNodePart;
        expect(part).to.be.instanceof(ChildNodePart);
        expect(part.previousSibling).to.equal(child1El.previousSibling);
        expect(part.nextSibling).to.equal(child2El.nextSibling);
        expect(part.getCachedValid()).to.be.true;
        expect(part.metadata).to.deep.equal([
          "child-node-previous1-metadata",
          "child-node-next1-metadata",
        ]);

        const nestedParts = part.getCachedParts();
        expect(nestedParts.length).to.equal(1);
        const nestedPart1 = nestedParts[0] as NodePart;
        expect(nestedPart1).to.be.instanceof(NodePart);
        expect(nestedPart1.node).to.equal(child2El);
        expect(nestedPart1.valid).to.be.true;
        expect(nestedPart1.metadata).to.deep.equal(["child2-node-metadata"]);
      });

      it("node, child node, and nested parts", () => {
        document.body.innerHTML =
          "<?node-part parent-node-metadata?><div id='parent'>" +
          "<?child-node-part child-node-previous1-metadata?>" +
          "<div id='child1'></div>" +
          "<?node-part child2-node-metadata?><div id='child2'></div>" +
          "<?/child-node-part child-node-next1-metadata?>" +
          "<?child-node-part child-node-previous2-metadata?>" +
          "<div id='child3'></div>" +
          "<?/child-node-part child-node-next2-metadata?>" +
          "</div>";

        const parentEl = document.getElementById("parent")!;
        const child1El = document.getElementById("child1")!;
        const child2El = document.getElementById("child2")!;
        const child3El = document.getElementById("child3")!;

        documentPart = getDocumentPart(document);
        const parts = documentPart.getCachedParts();
        expect(parts.length).to.equal(3);
        const part1 = parts[0] as NodePart;
        expect(part1).to.be.instanceOf(NodePart);
        expect(part1.node).to.equal(parentEl);
        expect(part1.valid).to.be.true;
        expect(part1.metadata).to.deep.equal(["parent-node-metadata"]);

        const part2 = parts[1] as ChildNodePart;
        expect(part2).to.be.instanceof(ChildNodePart);
        expect(part2.previousSibling).to.equal(child1El.previousSibling);
        expect(part2.nextSibling).to.equal(child2El.nextSibling);
        expect(part2.getCachedValid()).to.be.true;
        expect(part2.metadata).to.deep.equal([
          "child-node-previous1-metadata",
          "child-node-next1-metadata",
        ]);

        const nestedParts = part2.getCachedParts();
        expect(nestedParts.length).to.equal(1);
        const nestedPart1 = nestedParts[0] as NodePart;
        expect(nestedPart1).to.be.instanceof(NodePart);
        expect(nestedPart1.node).to.equal(child2El);
        expect(nestedPart1.valid).to.be.true;
        expect(nestedPart1.metadata).to.deep.equal(["child2-node-metadata"]);

        const part3 = parts[2] as ChildNodePart;
        expect(part3).to.be.instanceof(ChildNodePart);
        expect(part3.previousSibling).to.equal(child3El.previousSibling);
        expect(part3.nextSibling).to.equal(child3El.nextSibling);
        expect(part3.getCachedValid()).to.be.true;
        expect(part3.metadata).to.deep.equal([
          "child-node-previous2-metadata",
          "child-node-next2-metadata",
        ]);
        expect(part3.getCachedParts()).to.deep.equal([]);
      });
    });

    describe("with errors", () => {
      it("unterminated child node part", () => {
        document.body.innerHTML =
          "<?child-node-part?>" +
          "<div id='child1'></div>" +
          "<?node-part?><div id='child2'></div>";

        documentPart = getDocumentPart(document);
        expect(documentPart.getCachedParts()).to.deep.equal([]);
      });

      it("terminated child node part at different level", () => {
        document.body.innerHTML =
          "<?child-node-part?>" +
          "<div id='child1'></div>" +
          "<?node-part?><div id='child2'></div>" +
          "<div>" +
          "<?/child-node-part child-node-next1-metadata?>" +
          "</div>";

        documentPart = getDocumentPart(document);
        expect(documentPart.getCachedParts()).to.deep.equal([]);
      });

      it("extra child node part end", () => {
        document.body.innerHTML =
          "<?child-node-part?>" +
          "<div id='child1'></div>" +
          "<?node-part?><div id='child2'></div>" +
          "<?/child-node-part child-node-next1-metadata?>" +
          "<?/child-node-part?>";

        documentPart = getDocumentPart(document);
        const parts = documentPart.getCachedParts();
        expect(parts.length).to.equal(1);
      });

      it("malformed nested child node part adds to parent", () => {
        document.body.innerHTML =
          "<?child-node-part?>" +
          "<div id='child1'></div>" +
          "<?child-node-part?>" +
          "<?node-part?><div id='child2'></div>" +
          "<?/child-node-part?>" +
          "<?/child-node-part child-node-next1-metadata?>";

        documentPart = getDocumentPart(document);
        const parts = documentPart.getCachedParts();
        expect(parts.length).to.equal(1);

        const part = parts[0] as ChildNodePart;
        expect(part.getCachedParts().length).to.equal(1);
      });
    });

    describe("gets parts", () => {
      it("nested", () => {
        documentPart = getDocumentPart(document);
        const { parent, children } = createDom();
        document.body.appendChild(parent);

        expect(documentPart.getCachedParts()).to.deep.equal([]);
        expect(documentPart.getParts()).to.deep.equal([]);

        const nodePart1 = new NodePart(children[0]);
        const nodePart2 = new NodePart(children[1]);
        const nodePart3 = new NodePart(children[2]);

        expect(documentPart.getCachedParts()).to.deep.equal([]);
        expect(documentPart.getParts()).to.deep.equal([
          nodePart1,
          nodePart2,
          nodePart3,
        ]);

        nodePart1.disconnect();
        expect(documentPart.getCachedParts()).to.deep.equal([
          nodePart1,
          nodePart2,
          nodePart3,
        ]);
        expect(documentPart.getParts()).to.deep.equal([nodePart2, nodePart3]);
        nodePart3.disconnect();
        expect(documentPart.getCachedParts()).to.deep.equal([
          nodePart2,
          nodePart3,
        ]);
        expect(documentPart.getParts()).to.deep.equal([nodePart2]);
        nodePart2.disconnect();
        expect(documentPart.getCachedParts()).to.deep.equal([nodePart2]);
        expect(documentPart.getParts()).to.deep.equal([]);
        expect(documentPart.getCachedParts()).to.deep.equal([]);
      });

      it("deeply nested", () => {
        documentPart = getDocumentPart(document);
        const { parent, children } = createDom();
        document.body.appendChild(parent);
        const nestedChildren = addChildren(children[2], "nested-child", 3);
        const deeplyNestedChildren = addChildren(
          nestedChildren[1],
          "deeply-nested-child",
          3
        );

        expect(documentPart.getCachedParts()).to.deep.equal([]);
        expect(documentPart.getParts()).to.deep.equal([]);

        const nestedChildNodePart = new ChildNodePart(
          nestedChildren[0],
          nestedChildren[2]
        );
        expect(documentPart.getCachedParts()).to.deep.equal([]);
        expect(documentPart.getParts()).to.deep.equal([nestedChildNodePart]);
        expect(documentPart.getCachedParts()).to.deep.equal([
          nestedChildNodePart,
        ]);
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([]);

        const nodePart1 = new NodePart(deeplyNestedChildren[0]);
        const nodePart2 = new NodePart(deeplyNestedChildren[1]);
        const nodePart3 = new NodePart(deeplyNestedChildren[2]);

        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([
          nodePart1,
          nodePart2,
          nodePart3,
        ]);

        nodePart1.disconnect();
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([
          nodePart1,
          nodePart2,
          nodePart3,
        ]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([
          nodePart2,
          nodePart3,
        ]);
        nodePart3.disconnect();
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([
          nodePart2,
          nodePart3,
        ]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([nodePart2]);
        nodePart2.disconnect();
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([nodePart2]);
        expect(nestedChildNodePart.getParts()).to.deep.equal([]);
        expect(nestedChildNodePart.getCachedParts()).to.deep.equal([]);
      });
    });

    describe("clone", () => {
      it("node, child node, and nested parts", () => {
        document.body.innerHTML =
          "<?node-part parent-node-metadata?><div id='parent'>" +
          "<?child-node-part child-node-previous1-metadata?>" +
          "<div id='child1'></div>" +
          "<?node-part child2-node-metadata?><div id='child2'></div>" +
          "<?/child-node-part child-node-next1-metadata?>" +
          "<?child-node-part child-node-previous2-metadata?>" +
          "<div id='child3'></div>" +
          "<?/child-node-part child-node-next2-metadata?>" +
          "</div>";

        documentPart = getDocumentPart(document);
        const documentPartClone = documentPart.clone();
        const documentClone = documentPartClone.document;

        const parentEl = documentClone.getElementById("parent")!;
        const child1El = documentClone.getElementById("child1")!;
        const child2El = documentClone.getElementById("child2")!;
        const child3El = documentClone.getElementById("child3")!;

        const parts = documentPartClone.getCachedParts();
        expect(parts.length).to.equal(3);
        const part1 = parts[0] as NodePart;
        expect(part1).to.be.instanceOf(NodePart);
        expect(part1.node).to.equal(parentEl);
        expect(part1.valid).to.be.true;
        expect(part1.metadata).to.deep.equal(["parent-node-metadata"]);

        const part2 = parts[1] as ChildNodePart;
        expect(part2).to.be.instanceof(ChildNodePart);
        expect(part2.previousSibling).to.equal(child1El.previousSibling);
        expect(part2.nextSibling).to.equal(child2El.nextSibling);
        expect(part2.getCachedValid()).to.be.true;
        expect(part2.metadata).to.deep.equal([
          "child-node-previous1-metadata",
          "child-node-next1-metadata",
        ]);

        const nestedParts = part2.getCachedParts();
        expect(nestedParts.length).to.equal(1);
        const nestedPart1 = nestedParts[0] as NodePart;
        expect(nestedPart1).to.be.instanceof(NodePart);
        expect(nestedPart1.node).to.equal(child2El);
        expect(nestedPart1.valid).to.be.true;
        expect(nestedPart1.metadata).to.deep.equal(["child2-node-metadata"]);

        const part3 = parts[2] as ChildNodePart;
        expect(part3).to.be.instanceof(ChildNodePart);
        expect(part3.previousSibling).to.equal(child3El.previousSibling);
        expect(part3.nextSibling).to.equal(child3El.nextSibling);
        expect(part3.getCachedValid()).to.be.true;
        expect(part3.metadata).to.deep.equal([
          "child-node-previous2-metadata",
          "child-node-next2-metadata",
        ]);
        expect(part3.getCachedParts()).to.deep.equal([]);
      });
    });
  });
});
