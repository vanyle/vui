export namespace VUI {
  export abstract class Component extends HTMLElement {
    _renderingScheduled = false;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
    connectedCallback() {
      this.initAttributes();
      this.renderHTML();
    }
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
      this.initAttributes();
    }

    initAttributes() {}

    disconnectedCallback() {}

    /**
     *  Call this method to schedule a rerender.
     */
    renderHTML(): void {
      // Batch the calls together to avoid excessive rerenders in the same event loop.
      if (this._renderingScheduled) return;
      this._renderingScheduled = true;
      queueMicrotask(() => {
        this._renderingScheduled = false;
        if (!this.shadowRoot) return;
        if (this.shadowRoot.childNodes.length === 0) {
          const tree = this.render();
          // If the shadow root is empty, we can just append the new content
          this.shadowRoot.appendChild(toFrag(tree, false));
          setAttributesOnNodes(this.shadowRoot, tree.propertiesToSet); // we set attribute after appending to the root, so that constructors have time to run.
        }

        const tree = this.render();
        applyDiff(this.shadowRoot, tree.fragment, tree.subtrees); // always diff for stability
        setAttributesOnNodes(this.shadowRoot, tree.propertiesToSet);

        this.postRender(this.shadowRoot);
      });
    }

    /**
     * Render the component's HTML.
     * Usually, you will use the `html` function to create a DocumentFragment:
     * ```ts
     * 	return html`<div>My content</div>`;
     * ```
     *
     * Never call this method directly, use `renderHTML()` instead.
     *
     * Note: You give up ownership of the nodes you return, so you cannot reuse them.
     */
    abstract render(): UnevaluatedFragment;

    /**
     * Called after each rendered to manipulate the DOM to change attributes, add event listeners, etc.
     */
    postRender(shadowRoot: ShadowRoot): void {}
  }

  export function register(name: string) {
    return function (target: Function) {
      if (!customElements.get(name)) {
        customElements.define(name, target as CustomElementConstructor);
        console.log(`Component ${name} registered.`);
      } else {
        console.warn(`Component ${name} is already registered.`);
      }
    };
  }

  export function attribute(_propertyKey: string) {
    return function <T extends Component, V>(
      target: ClassAccessorDecoratorTarget<T, V>,
      context: ClassAccessorDecoratorContext<T, V>
    ) {
      const ref = { val: undefined as V };
      return {
        init: function (this: T, initialValue: V) {
          ref.val = initialValue;
          return initialValue;
        },
        get: function (this: T) {
          return ref.val;
        },
        set: function (this: T, value: V) {
          ref.val = value;
          this.renderHTML();
        },
      };
    };
  }
}

/**
 * A templating function that build a fragment from the expressions provided.
 * Example:
 * ``ts
 * const fragment = html`<div class="example">${title}</div>`;
 *
 */
export function html(
  raw: TemplateStringsArray,
  ...expressions: (AllowedTemplateExpressions | AllowedTemplateExpressions[])[]
): UnevaluatedFragment {
  // Start by merging the expressions and the raws in one array without interpreting.
  const baseArray: {
    expression: AllowedTemplateExpressions;
    type: "raw" | "expression";
  }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (typeof r === "undefined") continue;
    baseArray.push({ expression: trimBetweenTags(r), type: "raw" });
    if (i < expressions.length) {
      const element = expressions[i];
      if (element instanceof Array) {
        for (const subElement of element) {
          baseArray.push({ expression: subElement, type: "expression" });
        }
      } else {
        baseArray.push({ expression: element, type: "expression" });
      }
    }
  }

  const template = document.createElement("template");
  const nodesToEvaluate: Record<string, Node> = {}; // Nodes that need to be evaluated later

  const nodeFunctionMap: Record<
    string,
    { eventName: string; action: (this: Element, ev: Event) => void }
  > = {};
  const attributeMap: Record<string, { name: string; value: unknown }> = {};

  let result: (string | Node)[] = [];
  for (let i of baseArray.keys()) {
    if (typeof baseArray[i] === "undefined") continue;
    const { expression: currentExpression, type: expressionType } =
      baseArray[i];
    if (currentExpression instanceof Node) {
      result.push(currentExpression);
      continue;
    }
    // === Unevaluated Fragment Nesting ===
    if (isUnevaluatedFragment(currentExpression)) {
      // We need to merge the keys of the expressions. Because the ids are unique, there is not conflict.
      for (const key in currentExpression.subtrees) {
        if (key in nodesToEvaluate) {
          console.warn(
            `Duplicate key "${key}" found in unevaluated fragment expressions. This might lead to unexpected behavior.`
          );
        }
        if (!currentExpression.subtrees[key]) continue;
        nodesToEvaluate[key] = currentExpression.subtrees[key];
      }
      for (const key in currentExpression.propertiesToSet) {
        if (key in attributeMap) {
          console.warn(
            `Duplicate key "${key}" found in unevaluated fragment attribute map. This might lead to unexpected behavior.`
          );
        }
        if (!currentExpression.propertiesToSet[key]) continue;
        attributeMap[key] = currentExpression.propertiesToSet[key];
      }

      for (const child of currentExpression.fragment.children) {
        result.push(child);
      }
      continue;
    }

    if (currentExpression instanceof DocumentFragment) {
      for (const child of currentExpression.children) {
        result.push(child);
      }
      continue;
    }

    const previousExpression = baseArray[i - 1]
      ? baseArray[i - 1]?.expression
      : undefined;

    // There might be templating / attributes going on, so we check for that ( .aa=${bb} or ?aa=${bb} ).
    if (
      typeof previousExpression === "string" &&
      previousExpression[previousExpression.length - 1] === "="
    ) {
      {
        const { attributeName, strippedNodeString } =
          extractAttributeFromNodeString(previousExpression, ".");
        if (isValidAttributeName(attributeName)) {
          const uniqueId = getUniqueId();
          result.pop();
          result.push(strippedNodeString + ` data-vui-node-id-${uniqueId} `);
          // NB: we don't need to escape html here.
          attributeMap[uniqueId] = {
            value: currentExpression,
            name: attributeName,
          };
          continue;
        }
      }
      {
        const { attributeName: booleanAttributeName, strippedNodeString } =
          extractAttributeFromNodeString(previousExpression, "?");
        if (isValidAttributeName(booleanAttributeName)) {
          if (typeof currentExpression !== "boolean") {
            console.warn(
              `Invalid template syntax: Use ?${booleanAttributeName}= before a boolean expression, got "${currentExpression}"`
            );
            result.pop();
            result.push(strippedNodeString + " ");
            continue;
          }
          const uniqueId = getUniqueId();
          result.pop();
          if (currentExpression) {
            // ignore if false
            result.push(strippedNodeString + ` data-vui-node-id-${uniqueId} `);
            attributeMap[uniqueId] = {
              value: true,
              name: booleanAttributeName,
            };
          } else {
            // If the expression is false, we do not add the attribute.
            result.push(strippedNodeString + " ");
          }
          continue;
        }
      }
    }

    if (typeof currentExpression !== "function") {
      // Resolve false, undefined and null to empty string.
      if (
        currentExpression === false ||
        currentExpression === undefined ||
        currentExpression === null
      ) {
        result.push("");
      } else if (expressionType === "raw") {
        result.push(String(currentExpression));
      } else if (
        currentExpression &&
        typeof currentExpression === "object" &&
        "type" in currentExpression &&
        "value" in currentExpression
      ) {
        result.push(String(currentExpression.value));
      } else {
        result.push(escapeHtml(String(currentExpression)));
      }
      continue;
    }

    if (!previousExpression || typeof previousExpression !== "string") {
      // If the previous expression is not a string, we cannot extract an event name (and the templating is not valid)
      console.warn(
        `Invalid template syntax at index ${i}: expected a string before a function, got "${previousExpression}"`
      );
      result.push(String(currentExpression));
      continue;
    }
    const { attributeName: eventName, strippedNodeString } =
      extractAttributeFromNodeString(previousExpression);
    if (eventName.startsWith("on")) {
      console.warn(
        `There might be an error with an event name. Use @${eventName.substring(
          2
        )}= and not @${eventName}= in templates, got "${previousExpression}"`
      );
    }
    if (eventName === "") {
      console.warn(
        `Invalid template syntax: Use @eventName= before a function to bind it to an event, got "${previousExpression}"`
      );
      result.push(String(currentExpression));
      continue;
    }

    const uniqueNodeId = getUniqueId();
    result.pop();
    result.push(strippedNodeString + ` data-vui-node-id-${uniqueNodeId} `);
    nodeFunctionMap[uniqueNodeId] = {
      action: currentExpression as (this: Element, ev: Event) => void,
      eventName: eventName,
    };
  }

  // Build the object from the strings and the nodes
  let currentString: string[] = [];
  for (let r of result) {
    if (typeof r === "string") {
      currentString.push(r);
      continue;
    }
    const uniqueId = getUniqueId();
    currentString.push(`<span data-vui-placeholder-id="${uniqueId}"></span>`);
    nodesToEvaluate[uniqueId] = r;
  }
  template.innerHTML = currentString.join("");

  // Bind all the events to the nodes and remove the `vui-node-id` attribute
  for (const nodeId in nodeFunctionMap) {
    const eventInfo = nodeFunctionMap[nodeId];
    const node = template.content.querySelector(`[data-vui-node-id-${nodeId}]`);
    if (node && eventInfo) {
      node.addEventListener(eventInfo.eventName, eventInfo.action);
      node.removeAttribute(`data-vui-node-id-${nodeId}`);
    }
  }

  return {
    fragment: template.content,
    subtrees: nodesToEvaluate,
    propertiesToSet: attributeMap,
  };
}

function trimBetweenTags(r: string): string {
  const trim = r.trim();
  if (trim[0] === "<") {
    //|| (i > 0 && raw[i - 1].trim()[raw[i - 1].length - 1] === '>')
    r = r.replace(/^\s+/, "");
  }
  if (trim[trim.length - 1] === ">") {
    //|| (i < l - 1 && raw[i + 1].trim()[0] === '<')
    r = r.replace(/\s+$/, "");
  }
  return r;
}

export function css(
  raw: TemplateStringsArray,
  ...expressions: AllowedCSSExpressions[]
): CSSStyleSheet {
  // ... evaluate everything
  const sheet = new CSSStyleSheet();
  sheet.replaceSync("");
  return sheet;
}

function getKeyOr(node: Node, defaultKey: string) {
  if (node instanceof Element) {
    return node.getAttribute("data-key") ?? defaultKey;
  }
  return defaultKey;
}

/**
 *  Placeholder node aware diffing algorithm.
 */
function applyDiff(
  originalDom: DocumentFragment | Node,
  newElements: DocumentFragment | Node,
  fragmentContext: Record<string, Node> = {}
) {
  // Sometimes, the browser adds empty text nodes which we don't want to consider
  const originalChildren = Array.from(originalDom.childNodes).filter(
    (node) => !isEmptyTextNode(node)
  );

  const newChildren = Array.from(newElements.childNodes)
    .filter((node) => !isEmptyTextNode(node))
    .map((node) => {
      if (
        node instanceof Element &&
        node.hasAttribute("data-vui-placeholder-id")
      ) {
        const id = node.getAttribute("data-vui-placeholder-id") || "";
        if (fragmentContext[id]) {
          return fragmentContext[id];
        }
      }
      return node;
    });

  const keyedOriginals = new Map<string, Node>();
  originalChildren.forEach((child, index) => {
    const key = getKeyOr(child, String(index));
    keyedOriginals.set(key, child);
  });

  newChildren.forEach((newChild, index) => {
    const key = getKeyOr(newChild, String(index));
    const originalChild = key
      ? keyedOriginals.get(key)
      : originalChildren[index];

    if (originalChild) {
      diffNodes(originalChild, newChild, fragmentContext);
      // re-order the original child to make it match the new child.
      const parent = originalChild.parentElement;
      if (parent) {
        if (
          index == newChildren.length - 1 &&
          parent.lastChild !== originalChild
        ) {
          parent.insertBefore(originalChild, null);
        } else if (parent.children[index] !== originalChild) {
          const next = parent.children[index + 1] ?? null;
          parent.insertBefore(originalChild, next);
        }
      }

      if (key) keyedOriginals.delete(key);
    } else {
      originalDom.appendChild(newChild);
      // Perform the placeholder replacements:
      if (newChild instanceof Element || newChild instanceof DocumentFragment) {
        newChild
          .querySelectorAll("[data-vui-placeholder-id]")
          .forEach((node) => {
            const id = node.getAttribute("data-vui-placeholder-id") || "";
            if (fragmentContext[id]) {
              node.replaceWith(fragmentContext[id]);
            }
          });
      }
    }
  });

  keyedOriginals.forEach((node) => {
    if (node instanceof CharacterData || node instanceof Element) {
      node.remove();
    }
  });
}

function diffAttributes(oldEl: Element, newEl: Element) {
  const oldAttrs = oldEl.attributes;
  const newAttrs = newEl.attributes;
  let isSame = true;

  for (const attr of Array.from(oldAttrs)) {
    if (!newEl.hasAttribute(attr.name)) {
      oldEl.removeAttribute(attr.name);
      isSame = false;
    }
  }

  for (const attr of Array.from(newAttrs)) {
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
      isSame = false;
    }
  }
  return isSame;
}

function isEmptyTextNode(node: Node): boolean {
  if (node.nodeType !== Node.TEXT_NODE) return false;
  return node.textContent?.trim().length === 0;
}

function diffNodes(
  originalNode: Node,
  newNode: Node,
  fragmentContext: Record<string, Node> = {}
): void {
  if (
    newNode.nodeType === Node.TEXT_NODE &&
    originalNode.nodeType === Node.TEXT_NODE
  ) {
    if (originalNode.textContent !== newNode.textContent) {
      originalNode.textContent = newNode.textContent;
    }
    return;
  }

  // if the original or the new node is marked as stable, we do not diff them. The component is responsible for updating them.
  if (
    originalNode instanceof Element &&
    originalNode.hasAttribute("data-stable")
  ) {
    return;
  }

  // If they are elements, diff attributes and children
  if (
    originalNode instanceof Element &&
    newNode instanceof Element &&
    originalNode.tagName == newNode.tagName
  ) {
    diffAttributes(originalNode, newNode);
    applyDiff(originalNode, newNode, fragmentContext); // Recurse on children
    return;
  }

  // If node types or tag names are different, replace the old node entirely
  if (
    originalNode.nodeType !== newNode.nodeType ||
    originalNode.nodeName !== newNode.nodeName
  ) {
    if (
      originalNode instanceof Element ||
      originalNode instanceof Text ||
      originalNode instanceof Comment
    ) {
      originalNode.replaceWith(newNode);
    }
    return;
  }
}

type BaseAllowedExpressions =
  | string
  | number
  | boolean
  | null
  | undefined
  | Node
  | DocumentFragment;

type AllowedCSSExpressions = string | number | boolean | null | undefined;

export type AllowedTemplateExpressions =
  | BaseAllowedExpressions
  | ((this: Element, ev: Event) => void)
  | BaseAllowedExpressions[];

/**
 * Converts `<div @click=` to `click`, taking characters after the `@` until the next `=`.
 */
function extractAttributeFromNodeString(
  nodeString: string,
  searchChar: string = "@"
): { attributeName: string; strippedNodeString: string } {
  // Find the last occurrence of '@' and the next '=' after it
  const atIdx = nodeString.lastIndexOf(searchChar);
  if (atIdx === -1)
    return { attributeName: "", strippedNodeString: nodeString };
  const eqIdx = nodeString.indexOf("=", atIdx);
  if (eqIdx === -1)
    return { attributeName: "", strippedNodeString: nodeString };
  const attributeName = nodeString.slice(atIdx + 1, eqIdx).trim();
  return { attributeName, strippedNodeString: nodeString.slice(0, atIdx) };
}

export type UnevaluatedFragment = {
  fragment: DocumentFragment;
  subtrees: Record<string, Node>;
  propertiesToSet: Record<string, { name: string; value: unknown }>;
};

function escapeHtml(unsafe: string): string {
  let div = document.createElement("div");
  div.appendChild(document.createTextNode(unsafe));
  return div.innerHTML;
}

export function unsafeHtml(unsafe: string) {
  return { value: unsafe, type: "unsafeHtml" };
}

function isValidAttributeName(name: string): boolean {
  // Attributes are valid JS identifiers, so no my-attribute.
  return /^[a-zA-Z_0-9]*$/.test(name) && name.length > 0;
}

function isUnevaluatedFragment(obj: unknown): obj is UnevaluatedFragment {
  return (
    !!obj &&
    typeof obj === "object" &&
    "fragment" in obj &&
    "subtrees" in obj &&
    obj.fragment instanceof DocumentFragment &&
    typeof obj.subtrees === "object"
  );
}

let uniqueIdCounter = 0;
function getUniqueId(): string {
  uniqueIdCounter++;
  return `${uniqueIdCounter}`;
}

export function toFrag(
  unevaluatedFragment: UnevaluatedFragment,
  shouldSetAttributes = true
): DocumentFragment {
  let placeholders = undefined;

  // Find and replace placeholders recursively, nodes inside expressions might also have placeholders.
  while (true) {
    placeholders = unevaluatedFragment.fragment.querySelectorAll(
      "[data-vui-placeholder-id]"
    );
    if (placeholders.length === 0) {
      break;
    }

    for (const p of placeholders) {
      const elementId = p.getAttribute("data-vui-placeholder-id") || "";
      if (!elementId) {
        p.remove();
      }
      const realElement = unevaluatedFragment.subtrees[elementId];
      if (!realElement) {
        console.warn(
          `Placeholder with id ${elementId} not found in the result array. This indicate a malformed template.`
        );
        p.remove();
      } else {
        p.replaceWith(realElement);
      }
    }
  }
  if (shouldSetAttributes) {
    setAttributesOnNodes(
      unevaluatedFragment.fragment,
      unevaluatedFragment.propertiesToSet
    );
  }
  return unevaluatedFragment.fragment;
}

function setAttributesOnNodes(
  fragment: DocumentFragment,
  attributes: Record<string, { name: string; value: unknown }>
) {
  // Set the attributes on the nodes
  for (const nodeId in attributes) {
    const node = fragment.querySelector(`[data-vui-node-id-${nodeId}]`);
    if (node) {
      if (!attributes[nodeId]) continue;
      const { name, value } = attributes[nodeId];
      const nodeAny = node as any;
      if (nodeAny[name] !== value) {
        nodeAny[name] = value;
      }
      node.removeAttribute(`data-vui-node-id-${nodeId}`);
    }
  }
}

export function cloneFrag(
  unevaluatedFragment: UnevaluatedFragment
): UnevaluatedFragment {
  const clonedFragment = document.createDocumentFragment();
  clonedFragment.appendChild(unevaluatedFragment.fragment.cloneNode(true));
  const clonedSubtrees: Record<string, Node> = {};
  for (const key in unevaluatedFragment.subtrees) {
    if (!unevaluatedFragment.subtrees[key]) continue;
    clonedSubtrees[key] = unevaluatedFragment.subtrees[key].cloneNode(true);
  }
  return {
    fragment: clonedFragment,
    subtrees: clonedSubtrees,
    propertiesToSet: unevaluatedFragment.propertiesToSet,
  };
}
