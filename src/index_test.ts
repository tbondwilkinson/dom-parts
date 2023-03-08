import {ChildNodePart, NodePart, Part} from './index';

describe('DOM parts', () => {
  describe('NodePart', () => {
    it('constructs', () => {
      const node = document.createElement('div');
      const metadata = ['metadata'];
      const nodePart = new NodePart(node, {metadata: metadata});
      expect(nodePart.node).toBe(node);
      expect(nodePart.metadata).toEqual(metadata);
    });
  });

  describe('ChildNodePart', () => {
    it('constructs', () => {
      const parent = document.createElement('div');
      const children = [];
      for (let i = 0; i < 5; i++) {
        const child = document.createElement('div');
        parent.appendChild(child);
        children.push(child);
      }
      const initialParts: Part[] = [];
      for (let i = 0; i < 5; i++) {
        const part = new NodePart(children[i]);
      }
      const metadata = ['metadata'];
      const childNodePart =
          new ChildNodePart(parent, children, initialParts, {metadata});
      expect(childNodePart.parent).toBe(parent);
      expect(childNodePart.children).toEqual(children);
      expect(childNodePart.getInitialParts()).toEqual(initialParts);
      expect(childNodePart.metadata).toEqual(metadata);
    });

    it('throws on incorrect child', () => {
      const parent = document.createElement('div');
      const child = document.createElement('div');
      document.body.appendChild(child);

      expect(() => {
        debugger;
        new ChildNodePart(parent, [child], []);
      }).toThrow();
    });
  });
});
