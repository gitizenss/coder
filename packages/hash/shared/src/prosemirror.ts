import { NodeSpec, NodeType, ProsemirrorNode, Schema } from "prosemirror-model";

type NodeWithAttrs<Attrs extends {}> = Omit<
  ProsemirrorNode<Schema>,
  "attrs"
> & { attrs: Attrs };

type ComponentNodeAttrs = {};
export type ComponentNode = NodeWithAttrs<ComponentNodeAttrs>;

export type EntityNode = NodeWithAttrs<{
  // @todo how can this ever be null?
  draftId: string | null;
}>;

export const isEntityNode = (
  node: ProsemirrorNode<Schema> | null,
): node is EntityNode => !!node && node.type === node.type.schema.nodes.entity;

export const componentNodeGroupName = "componentNode";

export const createSchema = () =>
  new Schema({
    nodes: {
      doc: {
        content: "((componentNode|block)+)|blank",
      },
      blank: {
        /**
         * As we don't have any component nodes defined by default, we need a
         * placeholder, otherwise Prosemirror will crash when trying to
         * interpret the content expressions in other nodes. However, as soon
         * as we have defined a different component node, we remove the blank
         * node from the componentNode group, which ensures that when
         * Prosemirror attempts to instantiate a componentNode it uses that
         * node instead of the blank one
         *
         * @see import("./ProsemirrorManager.ts").ProsemirrorManager#prepareToDisableBlankDefaultComponentNode
         */
        group: componentNodeGroupName,
        toDOM: () => ["div", 0] as const,
      },
      block: {
        content: "entity",
        /**
         * These properties are necessary for copy and paste (which is
         * necessary for drag and drop)
         *
         * @note – the actual rendering in the DOM is taken over by the NodeView
         *         so check `BlockView` and `ComponentView` for how this will
         *         actually appear
         */
        toDOM: () => {
          return [
            "div",
            {
              "data-hash-type": "block",
            },
            0,
          ] as const;
        },
        parseDOM: [
          {
            tag: 'div[data-hash-type="block"]',
          },
        ],
      },
      entity: {
        content: "componentNode | entity",
        attrs: {
          draftId: { default: null },
        },
        toDOM: () => {
          return ["div", { "data-hash-type": "entity" }, 0] as const;
        },
        parseDOM: [
          {
            tag: 'div[data-hash-type="entity"]',
          },
        ],
      },
      text: {
        group: "inline",
      },
      /**
       * This is serialized as a new line in `createEditorView` when copying to
       * plain text
       *
       * @todo figure out to do this here
       * @see createEditorView
       */
      hardBreak: {
        inline: true,
        group: "inline",
        selectable: false,
        parseDOM: [{ tag: "br" }],
        toDOM() {
          return ["br"];
        },
      },
      mention: {
        inline: true,
        group: "inline",
        atom: true,
        attrs: { mentionType: { default: null }, entityId: { default: null } },
        toDOM: (node) => {
          const { mentionType, entityId } = node.attrs;
          return [
            "span",
            {
              "data-hash-type": "mention",
              "data-mention-type": mentionType,
              "data-entity-id": entityId,
            },
          ] as const;
        },
        parseDOM: [
          {
            tag: 'span[data-hash-type="mention"]',
            getAttrs(dom) {
              return {
                mentionType: (dom as Element).getAttribute("data-mention-type"),
                entityId: (dom as Element).getAttribute("data-entity-id"),
              };
            },
          },
        ],
      },
    },
    marks: {
      strong: {
        toDOM: () => ["strong", { style: "font-weight:bold;" }, 0] as const,
        parseDOM: [
          { tag: "strong" },
          /**
           * This works around a Google Docs misbehavior where
           * pasted content will be inexplicably wrapped in `<b>`
           * tags with a font-weight normal.
           * @see https://github.com/ProseMirror/prosemirror-schema-basic/blob/860d60f764dcdcf186bcba0423d2c589a5e34ae5/src/schema-basic.js#L136
           */
          {
            tag: "b",
            getAttrs: (node) => {
              /**
               * It is always a Node for tag rules but the types aren't
               * smart enough for that
               *
               * @todo remove the need for this cast
               */
              const castNode = node as unknown as HTMLElement;

              return castNode.style.fontWeight !== "normal" && null;
            },
          },
          {
            style: "font-weight",
            getAttrs(value) {
              /**
               * It is always a string for style rules but the types aren't
               * smart enough for that
               *
               * @todo remove the need for this cast
               */
              const castValue = value as unknown as string;
              if (/^(bold(er)?|[5-9]\d{2,})$/.test(castValue)) {
                return null;
              }
              return false;
            },
          },
        ],
      },
      em: {
        toDOM: () => ["em", 0] as const,
        parseDOM: [{ tag: "em" }, { tag: "i" }, { style: "font-style=italic" }],
      },
      /**
       * Some apps export underlines as HTML includes a style tag
       * creating some classes, which are then applied to the underlined
       * text. This includes Pages. It has not yet been figured out how to
       * handle this within Prosemirror, so this formatting will be lost
       * when pasting from these apps.
       *
       * @todo fix this
       */
      underlined: {
        toDOM: () => ["u", 0] as const,
        parseDOM: [
          { tag: "u" },
          { style: "text-decoration=underline" },
          { style: "text-decoration-line=underline" },
        ],
      },
      link: {
        attrs: {
          href: { default: "" },
        },
        inclusive: false,
        toDOM(node) {
          const { href } = node.attrs;
          return [
            "a",
            { href, style: "color: blue; text-decoration: underline" },
            0,
          ] as const;
        },
        parseDOM: [
          {
            tag: "a[href]",
            getAttrs(dom) {
              return {
                href: (dom as Element).getAttribute("href"),
              };
            },
          },
        ],
      },
    },
  });

export const isComponentNodeType = (nodeType: NodeType<Schema>) =>
  nodeType.groups?.includes(componentNodeGroupName) ?? false;

export const isComponentNode = (
  node: ProsemirrorNode<Schema>,
): node is ComponentNode => isComponentNodeType(node.type);

export const findComponentNodes = (
  containingNode: ProsemirrorNode<Schema>,
): ComponentNode[] => {
  const componentNodes: ComponentNode[] = [];

  containingNode.descendants((node) => {
    if (isComponentNode(node)) {
      componentNodes.push(node);
    }

    return true;
  });

  return componentNodes;
};

export const findComponentNode = (
  containingNode: ProsemirrorNode<Schema>,
  containingNodePosition: number,
): [ComponentNode, number] | null => {
  let result: [ComponentNode, number] | null = null;

  containingNode.descendants((node, pos) => {
    if (isComponentNode(node)) {
      result = [node, containingNodePosition + 1 + pos];

      return false;
    }

    return true;
  });

  return result;
};

export const componentNodeToId = (node: ComponentNode) => node.type.name;

declare interface OrderedMapPrivateInterface<T> {
  content: (string | T)[];
}

/**
 * Prosemirror is designed for you to design your document schema ahead of time
 * and for this not to change during the lifetime of your document. We support
 * dynamically loaded in new blocks, which requires creating new node types,
 * which therefore requires mutating the Prosemirror schema. This is not
 * officially supported, so we had to develop a hack to force Prosemirror to
 * mutate the schema for us to apply the expected changes for a new node type.
 *
 * We want to have the hacks necessary for this in one place, so this allows
 * a user to pass a function which will apply the mutations they want to apply,
 * and the relevant hacks are then applied after to process the mutation.
 *
 * This also deals with deleting the default "blank" node type which we create
 * when first creating a new schema before any blocks have been loaded in.
 */
export const mutateSchema = (
  schema: Schema,
  mutate: (map: OrderedMapPrivateInterface<NodeSpec>) => void,
) => {
  mutate(schema.spec.nodes as any);
  const blankType = schema.nodes.blank!;

  if (isComponentNodeType(blankType)) {
    if (blankType.spec.group?.includes(componentNodeGroupName)) {
      if (blankType.spec.group !== componentNodeGroupName) {
        throw new Error(
          "Blank node type has group expression more complicated than we can handle",
        );
      }

      delete blankType.spec.group;
    }

    blankType.groups!.splice(
      blankType.groups!.indexOf(componentNodeGroupName),
      1,
    );
  }

  // eslint-disable-next-line no-new
  new (class extends Schema {
    // @ts-expect-error: This is one of the hacks in our code to allow defining new node types at run time which isn't officially supported in ProseMirror
    get nodes() {
      return schema.nodes;
    }

    set nodes(newNodes) {
      for (const [key, value] of Object.entries(newNodes)) {
        if (!this.nodes[key]) {
          value.schema = schema;
          this.nodes[key] = value;
        } else {
          this.nodes[key]!.contentMatch = value.contentMatch;
        }
      }
    }

    // @ts-expect-error: This is one of the hacks in our code to allow defining new node types at run time which isn't officially supported in ProseMirror
    get marks() {
      return schema.marks;
    }

    set marks(newMarks) {
      for (const [key, value] of Object.entries(newMarks)) {
        if (!this.marks[key]) {
          value.schema = schema;
          this.marks[key] = value;
        }
      }
    }
  })(schema.spec);
};
