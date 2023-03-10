import {expect} from '@esm-bundle/chai';

import {ChildNodePart, NodePart} from '../index.js';

describe('DOM parts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('NodePart', () => {
    it('constructs', () => {
      const node = document.createElement('div');
      document.body.appendChild(node);
      const metadata = ['metadata'];
      const nodePart = new NodePart(node, {metadata: metadata});
      expect(nodePart.node).to.equal(node);
      expect(nodePart.metadata).to.equal(metadata);
    });
  });

  describe('ChildNodePart', () => {
    function createDom() {
      const parent = document.createElement('div');
      const children = [];
      for (let i = 0; i < 5; i++) {
        const child = document.createElement('div');
        parent.appendChild(child);
        children.push(child);
      }
      return {parent, children};
    }

    it('constructs', () => {
      const {children} = createDom();

      const metadata = ['metadata'];
      const childNodePart =
          new ChildNodePart(children[0], children[4], {metadata});
      expect(childNodePart.previousSibling).to.equal(children[0]);
      expect(childNodePart.nextSibling).to.equal(children[4]);
      expect(childNodePart.metadata).to.equal(metadata);
    });

    describe('errors on', () => {
      it('disconnected nodes', () => {
        const previousSibling = document.createElement('div');
        const nextSibling = document.createElement('div');

        expect(() => {
          new ChildNodePart(previousSibling, nextSibling);
        }).to.throw();
      });

      it('disconnected previousSibling', () => {
        const previousSibling = document.createElement('div');
        const nextSibling = document.createElement('div');
        document.body.appendChild(nextSibling);

        expect(() => {
          new ChildNodePart(previousSibling, nextSibling);
        }).to.throw();
      });

      it('disconnected nextSibling', () => {
        const previousSibling = document.createElement('div');
        document.body.appendChild(previousSibling);
        const nextSibling = document.createElement('div');
        document.body.appendChild(previousSibling);

        expect(() => {
          new ChildNodePart(previousSibling, nextSibling);
        }).to.throw();
      });

      it('siblings with different parents', () => {
        const parent = document.createElement('div');
        const previousSibling = document.createElement('div');
        parent.appendChild(previousSibling);
        const nextSibling = document.createElement('div');
        document.body.appendChild(nextSibling);

        expect(() => {
          new ChildNodePart(previousSibling, nextSibling);
        }).to.throw();
      });

      it('reversed siblings', () => {
        const {children} = createDom();

        expect(() => {
          new ChildNodePart(children[4], children[0]);
        }).to.throw();
      })

      it('existing ChildNodePart', () => {
        const {children} = createDom();

        new ChildNodePart(children[0], children[4]);

        expect(() => {
          new ChildNodePart(children[0], children[4]);
        }).to.throw();
      });

      it('existing previousSibling ChildNodePart', () => {
        const {children} = createDom();

        new ChildNodePart(children[0], children[4]);

        expect(() => {
          new ChildNodePart(children[0], children[1]);
        }).to.throw();
      });

      it('existing nextSibling ChildNodePart', () => {
        const {children} = createDom();

        new ChildNodePart(children[0], children[4]);

        expect(() => {
          new ChildNodePart(children[4], children[4]);
        }).to.throw();
      });

      it('overlapping ChildNodeParts', () => {
        const {children} = createDom();

        const childNodePart = new ChildNodePart(children[0], children[2]);

        expect(() => {
          new ChildNodePart(children[1], children[3]);
        }).to.throw();

        expect(childNodePart.valid).to.be.true;
      });
    });

    it('sibling ChildNodeParts', () => {
      const {children} = createDom();

      new ChildNodePart(children[0], children[2]);
      new ChildNodePart(children[2], children[4]);
    });
  });
});
