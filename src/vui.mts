/**
 * Set to true to debug the node diffing / rendering process.
 * The "key" of nodes if either their index in the parent or the data-key attribute.
 */
const DEBUG_DIFF_HELPER = false;

//#region html()
/**
 * Magic templating function to have HTML in JS.
 * Usage: const myFragment: DocumentFragment = html`<div @click=someFunction>Click me</div>`;
 *
 * We support a subset of Lit's templates: https://lit.dev/docs/templates/overview/
 * false renders to ''.
 */
export function html(
    raw: TemplateStringsArray,
    ...expressions: (AllowedExpressions | AllowedExpressions[])[]
): UnevaluatedFragment {
    // Start by merging the expressions and the raws in one array without interpreting.
    const baseArray: {
        expression: AllowedExpressions;
        type: "raw" | "expression";
    }[] = [];
    raw.forEach((rawi, i) => {
        baseArray.push({ expression: trimBetweenTags(rawi), type: "raw" });
        if (i < expressions.length) {
            baseArray.push({ expression: expressions[i], type: "expression" });
        }
    });

    const template = document.createElement("template");
    const nodesToEvaluate: Record<string, Node> = {}; // Nodes that need to be evaluated later

    const nodeFunctionMap: Record<
        string,
        { eventName: string; action: (this: Element, ev: Event) => void }
    > = {};
    const attributeMap: Record<string, { name: string; value: unknown }> = {};

    let result: (string | Node)[] = [];
    for (let i of baseArray.keys()) {
        const expr = baseArray[i];
        if (!expr) continue;
        const { expression: currentExpression, type: expressionType } = expr;

        const previousExpression = baseArray[i - 1]
            ? baseArray[i - 1]?.expression
            : undefined;

        // There might be templating / attributes going on, so we check for that ( .aa=${bb} or ?aa=${bb} ).
        if (
            typeof previousExpression === "string" &&
            previousExpression[previousExpression.length - 1] === "=" &&
            expressionType === "expression"
        ) {
            {
                const { attributeName, strippedNodeString } =
                    extractAttributeFromNodeString(previousExpression, ".");
                if (isValidAttributeName(attributeName)) {
                    const uniqueId = getUniqueId();
                    result.pop();
                    result.push(
                        strippedNodeString + ` data-vui-node-id-${uniqueId} `
                    );
                    // NB: we don't need to escape html here.
                    attributeMap[uniqueId] = {
                        value: currentExpression,
                        name: attributeName,
                    };
                    continue;
                }
            }
            {
                const {
                    attributeName: booleanAttributeName,
                    strippedNodeString,
                } = extractAttributeFromNodeString(previousExpression, "?");
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
                        result.push(
                            strippedNodeString +
                                ` data-vui-node-id-${uniqueId} `
                        );
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
            {
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

                if (typeof currentExpression !== "function") {
                    console.warn(
                        `Invalid template syntax: Use @eventName= before a function to bind it to an event, got "${currentExpression}"`
                    );
                    result.pop();
                    result.push(strippedNodeString + " ");
                } else {
                    const uniqueNodeId = getUniqueId();
                    result.pop();
                    result.push(
                        strippedNodeString +
                            ` data-vui-node-id-${uniqueNodeId} `
                    );
                    nodeFunctionMap[uniqueNodeId] = {
                        action: currentExpression as (
                            this: Element,
                            ev: Event
                        ) => void,
                        eventName: eventName,
                    };
                }
                continue;
            }
        }

        if (currentExpression instanceof Array) {
            currentExpression.forEach((expr) => {
                buildResultListFromExpression(
                    result,
                    expressionType,
                    expr,
                    nodesToEvaluate,
                    attributeMap
                );
            });
        } else {
            buildResultListFromExpression(
                result,
                expressionType,
                currentExpression,
                nodesToEvaluate,
                attributeMap
            );
        }
    }

    // Build the object from the strings and the nodes
    let currentString: string[] = [];
    for (let r of result) {
        if (typeof r === "string") {
            currentString.push(r);
            continue;
        }
        const uniqueId = getUniqueId();
        currentString.push(
            `<span data-vui-placeholder-id="${uniqueId}"></span>`
        );
        nodesToEvaluate[uniqueId] = r;
    }
    const stringForTemplate = whiteSpaceCleaning(currentString.join(""));
    template.innerHTML = stringForTemplate;

    // Bind all the events to the nodes and remove the `vui-node-id` attribute
    for (const nodeId in nodeFunctionMap) {
        const eventInfo = nodeFunctionMap[nodeId];
        const node = template.content.querySelector(
            `[data-vui-node-id-${nodeId}]`
        );
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

function buildResultListFromExpression(
    result: (string | Node)[],
    expressionType: "raw" | "expression",
    currentExpression: AllowedExpressions,
    nodesToEvaluate: Record<string, Node>,
    attributeMap: Record<string, { name: string; value: unknown }>
) {
    if (currentExpression instanceof Node) {
        result.push(currentExpression);
        return;
    }

    if (isUnevaluatedFragment(currentExpression)) {
        // We need to merge the keys of the expressions. Because the ids are unique, there is not conflict.
        for (const [key, value] of Object.entries(currentExpression.subtrees)) {
            if (key in nodesToEvaluate) {
                console.warn(
                    `Duplicate key "${key}" found in unevaluated fragment expressions. This might lead to unexpected behavior.`
                );
            }
            nodesToEvaluate[key] = value;
        }
        for (const [key, value] of Object.entries(
            currentExpression.propertiesToSet
        )) {
            if (key in attributeMap) {
                console.warn(
                    `Duplicate key "${key}" found in unevaluated fragment attribute map. This might lead to unexpected behavior.`
                );
            }
            attributeMap[key] = value;
        }

        for (const child of currentExpression.fragment.childNodes) {
            result.push(child);
        }
        return;
    }

    if (currentExpression instanceof DocumentFragment) {
        for (const child of currentExpression.childNodes) {
            result.push(child);
        }
        return;
    }

    if (
        currentExpression === false ||
        currentExpression === undefined ||
        currentExpression === null
    ) {
        result.push("");
        return;
    }
    if (expressionType === "raw") {
        result.push(String(currentExpression));
        return;
    }
    if (
        currentExpression &&
        typeof currentExpression === "object" &&
        "type" in currentExpression &&
        "value" in currentExpression
    ) {
        // unsafe HTML
        result.push(String(currentExpression.value));
        return;
    }
    result.push(escapeHtml(String(currentExpression)));
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

function whiteSpaceCleaning(str: string): string {
    // Algorithm taken from:
    // https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace#what_is_whitespace

    // 1. Remove all spaces and tabs immediately before and after a line break
    // 2. Any space immediately following another space is ignored
    return str
        .replace(/\t/g, " ")
        .replace(/(\s*\n\s*)/g, "\n")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

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

export function setContent(node: Element, fragment: DocumentFragment) {
    node.innerHTML = "";
    node.appendChild(fragment);
}

export namespace VUI {
    //#region Component
    export abstract class Component extends HTMLElement {
        _renderingScheduled = false;

        static get observedAttributes() {
            return Object.keys(this.attributePropertyMap);
        }
        static attributePropertyMap: Record<string, string> = {};
        static styles: CSSResult = css``;

        constructor() {
            super();
            const shadowRoot = this.attachShadow({ mode: "open" });
            const classType = this.constructor as typeof Component;
            queueMicrotask(() => {
                const stylesheet = getStylesheet(classType.styles);
                shadowRoot.adoptedStyleSheets = [stylesheet];
            });
        }
        connectedCallback() {
            this.initAttributes();
            this.renderHTML();
        }
        disconnectedCallback() {}
        attributeChangedCallback(
            name: string,
            oldValue: string,
            newValue: string
        ) {
            const classType = this.constructor as typeof Component;
            const correspondingProperty = classType.attributePropertyMap[name];
            if (correspondingProperty) {
                const that = this as Record<string, unknown>;
                that[correspondingProperty] = newValue;
            } else {
                console.warn(
                    `Attribute ${name} is not mapped to a property in ${this.tagName}.`
                );
            }
        }

        initAttributes() {
            const classType = this.constructor as typeof Component;
            for (let i = 0; i < this.attributes.length; i++) {
                const attr = this.attributes.item(i);
                if (!attr) continue;
                const correspondingProperty =
                    classType.attributePropertyMap[attr.nodeName];
                if (!correspondingProperty) continue;
                const that = this as Record<string, unknown>;
                that[correspondingProperty] = attr.value;
            }
        }

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

                if (DEBUG_DIFF_HELPER) {
                    console.log(`Rendering ${this.tagName}`);
                }
                const tree = this.render();
                applyDiff(
                    this.shadowRoot,
                    tree.fragment,
                    tree.subtrees,
                    this.tagName.toLowerCase()
                ); // always diff for stability
                setAttributesOnNodes(this.shadowRoot, tree.propertiesToSet);
                if (DEBUG_DIFF_HELPER) {
                    console.log(`Finished ${this.tagName}`);
                }

                this.postRender(this.shadowRoot);
            });
        }

        /**
         * Render the component's HTML.
         * Usually, you will use the `html` function to create a DocumentFragment:
         * ```typescript
         * return html`<div>My content</div>`;
         * ```
         * Never call this method directly, use `renderHTML()` instead.
         * This function might be called multiple times per render, so to keep it pure and don't rely on side-effects.
         *
         * Note: You give up ownership of the nodes you return, so you cannot reuse them.
         */
        abstract render(): UnevaluatedFragment;

        /**
         * Called after each rendered to manipulate the DOM to change attributes, add event listeners, etc.
         */
        postRender(shadowRoot: ShadowRoot): void {}
    }

    function getKeyOr(node: Node, defaultKey: string) {
        if (node instanceof Element) {
            return node.getAttribute("data-key") ?? defaultKey;
        }
        return defaultKey;
    }

    function flatten<T>(arr: T[][]): T[] {
        return arr.reduce((acc, val) => acc.concat(val), []);
    }

    function recursivelyReplacePlaceholders(
        node: Node,
        fragmentContext: Record<string, Node>
    ): Node[] {
        if (
            node instanceof Element &&
            node.hasAttribute("data-vui-placeholder-id")
        ) {
            const id = node.getAttribute("data-vui-placeholder-id") || "";
            if (fragmentContext[id]) {
                return recursivelyReplacePlaceholders(
                    fragmentContext[id],
                    fragmentContext
                );
            } else {
                console.warn(
                    `Placeholder with id "${id}" not found in the context. Available placeholders: `,
                    fragmentContext
                );
            }
        }
        if (node instanceof DocumentFragment) {
            return flatten(
                Array.from(node.childNodes).map((child) =>
                    recursivelyReplacePlaceholders(child, fragmentContext)
                )
            );
        }

        return [node];
    }

    function modifyToReplaceAllPlaceholdersOnChildren(
        node: Node,
        fragmentContext: Record<string, Node>
    ) {
        if (node instanceof Element || node instanceof DocumentFragment) {
            node.querySelectorAll("[data-vui-placeholder-id]").forEach(
                (placeholder) => {
                    const id =
                        placeholder.getAttribute("data-vui-placeholder-id") ||
                        "";
                    if (fragmentContext[id]) {
                        const replacement = recursivelyReplacePlaceholders(
                            fragmentContext[id],
                            fragmentContext
                        );
                        placeholder.replaceWith(...replacement);
                    } else {
                        console.warn(
                            `Placeholder with id "${id}" not found in the context. Available placeholders: `,
                            fragmentContext
                        );
                    }
                }
            );
        }
    }

    //#region Tree Diffing
    /**
     *  Placeholder node aware diffing algorithm.
     */
    function applyDiff(
        originalDom: DocumentFragment | Node,
        newElements: DocumentFragment | Node,
        fragmentContext: Record<string, Node> = {},
        componentName: string = "unknown" // used for debugging
    ) {
        const originalChildren = Array.from(originalDom.childNodes);

        const unflattenNewChildren = Array.from(newElements.childNodes).map(
            (node) => recursivelyReplacePlaceholders(node, fragmentContext)
        );
        const newChildren: Node[] = flatten(unflattenNewChildren);

        const keyedOriginals = new Map<string, Node>();
        originalChildren.forEach((child, index) => {
            const key = getKeyOr(child, "idx-" + String(index));
            keyedOriginals.set(key, child);
        });

        newChildren.forEach((newChild, index) => {
            const key = getKeyOr(newChild, "idx-" + String(index));
            const originalChild = key
                ? keyedOriginals.get(key)
                : originalChildren[index];
            let isOriginalChildKept = !!originalChild;

            if (originalChild) {
                const wasReplaced = diffNodes(
                    originalChild,
                    newChild,
                    fragmentContext,
                    componentName
                );

                if (wasReplaced) {
                    isOriginalChildKept = false;
                    modifyToReplaceAllPlaceholdersOnChildren(
                        newChild,
                        fragmentContext
                    );
                }

                if (key) keyedOriginals.delete(key);
            } else {
                if (DEBUG_DIFF_HELPER) {
                    console.log(
                        `   Adding a new node with key "${key}" at index ${index} as no original could be found.`
                    );
                    console.log("   ", nodePrintHelper(newChild));
                }
                modifyToReplaceAllPlaceholdersOnChildren(
                    newChild,
                    fragmentContext
                );
            }

            // Perform insertion at the correct place.
            // re-order the original child to make it match the index of new child.
            const parentChildren = Array.from(originalDom.childNodes);
            if (DEBUG_DIFF_HELPER) {
                const needReordering = parentChildren[index] !== originalChild;
                if (needReordering) {
                    if (originalChild) {
                        console.log(
                            `   Moving node with key "${key}" to the index ${index}/${parentChildren.length}.`
                        );
                        console.log(
                            "   ",
                            nodePrintHelper(originalChild),
                            " was moved."
                        );
                    } else {
                        console.log(
                            `   Adding a new node with key "${key}" at index ${index} as no original could be found.`
                        );
                        console.log("   ", nodePrintHelper(newChild));
                    }
                }
            }

            const nodeToMoveOrAppend =
                isOriginalChildKept && originalChild ? originalChild : newChild;
            if (index >= originalDom.childNodes.length) {
                originalDom.appendChild(nodeToMoveOrAppend);
            } else if (
                index === originalDom.childNodes.length - 1 &&
                originalDom.lastChild !== originalChild
            ) {
                originalDom.insertBefore(nodeToMoveOrAppend, null);
            } else if (parentChildren[index] !== originalChild) {
                const nextChild = parentChildren[index + 1];
                originalDom.insertBefore(nodeToMoveOrAppend, nextChild || null);
            }
        });

        keyedOriginals.forEach((node) => {
            if (node instanceof CharacterData || node instanceof Element) {
                if (DEBUG_DIFF_HELPER) {
                    console.log(
                        `   Removing an old node as it was not returned during rendering.`
                    );
                    console.log("   ", nodePrintHelper(node));
                }
                node.remove();
            }
        });
    }

    // For text nodes, return something nicer than #text (which is not very useful).
    function nodePrintHelper(node: Node): string | Node {
        if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            let formattedParentDescription = "null";
            if (parent) {
                formattedParentDescription = parent.tagName.toLowerCase();
                if (parent.id) {
                    formattedParentDescription += `#${parent.id}`;
                }
                if (parent.className) {
                    formattedParentDescription += `.${parent.className}`;
                }
            }
            return `#textNode(parent=${formattedParentDescription})[${node.textContent}]`;
        }
        return node;
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

    /**
     * @param originalNode
     * @param newNode
     * @param fragmentContext
     * @returns true if the nodes are essentially the same, false if a replacement was made.
     */
    function diffNodes(
        originalNode: Node,
        newNode: Node,
        fragmentContext: Record<string, Node> = {},
        componentName: string = "unknown"
    ): boolean {
        if (
            newNode.nodeType === Node.TEXT_NODE &&
            originalNode.nodeType === Node.TEXT_NODE
        ) {
            if (originalNode.textContent !== newNode.textContent) {
                originalNode.textContent = newNode.textContent;
            }
            return false;
        }

        // if the original or the new node is marked as stable, we do not diff them. The component is responsible for updating them.
        if (
            originalNode instanceof Element &&
            originalNode.hasAttribute("data-stable")
        ) {
            return false;
        }

        if (originalNode === newNode) {
            console.warn(
                `A stale node was produced while rendering ${componentName}. Do not store HTML elements between render() calls.`
            );
            console.warn(
                "   ",
                nodePrintHelper(originalNode),
                "was stored. A copy should be made instead."
            );
            return false;
        }

        // If they are elements, diff attributes and children
        if (
            originalNode instanceof Element &&
            newNode instanceof Element &&
            originalNode.tagName == newNode.tagName
        ) {
            diffAttributes(originalNode, newNode);
            applyDiff(originalNode, newNode, fragmentContext, componentName); // Recurse on children
            return false;
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
                if (DEBUG_DIFF_HELPER) {
                    const isTypeDifferent =
                        originalNode.nodeType !== newNode.nodeType;
                    const cause = isTypeDifferent
                        ? "nodes have different types"
                        : "nodes have different tag names";
                    console.log(`   Replacing a full node because ${cause}`);
                    console.log(
                        "   ",
                        nodePrintHelper(originalNode),
                        "becomes",
                        nodePrintHelper(newNode)
                    );
                }
                originalNode.replaceWith(newNode);
            }
            return true;
        }

        // Probably comments, CDATA or another type of node we don't handle. Does not matter as they are not rendered or are not used normally.
        if (DEBUG_DIFF_HELPER) {
            console.log(
                `   Node types are the same but we don't handle differences between these type of node: ${originalNode.nodeType}`
            );
            console.log(
                "   ",
                nodePrintHelper(originalNode),
                "does not becomes",
                nodePrintHelper(newNode)
            );
        }
        return false;
    }
}

let currentlyRegisteredAttributes: Record<string, string> = {}; // attribute -> property mapping

export function customElement(elementName: string) {
    return function (
        constructor: typeof VUI.Component & CustomElementConstructor
    ) {
        for (const [attribute, property] of Object.entries(
            currentlyRegisteredAttributes
        )) {
            constructor.attributePropertyMap[attribute] = String(property);
        }

        currentlyRegisteredAttributes = {};

        if (!customElements.get(elementName)) {
            customElements.define(elementName, constructor); // observedAttributes is read here.
        } else {
            console.warn(`Component ${elementName} is already registered.`);
        }
    };
}

//#region state
/**
 * Decorator used to indicate that the component should be rerendered when the property changes.
 * Usage:
 * ```ts
 * ⠀@state()
 *  myProperty;
 * ```
 */
export function state() {
    return function <T extends VUI.Component, V>(
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

/**
 * Decorator used to indicate that a property can be set as an attribute in the HTML.
 * Usage:
 * ```ts
 * ⠀@attribute({ name: "my-property" })
 *  myProperty = "default";
 * ```
 */
export function attribute({ name: attributeName }: { name?: string }) {
    return function <T extends VUI.Component, V>(
        value: ClassAccessorDecoratorTarget<T, V>,
        context: ClassAccessorDecoratorContext<T, V>
    ) {
        // During attribute decoration, we don't have access to the class type yet as it is not built.
        // We can add it to the attributePropertyMap and add the observedAttributes during the registration.
        const propertyName = String(context.name);
        currentlyRegisteredAttributes[attributeName || propertyName] =
            propertyName;

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

type AllowedExpressions =
    | null
    | undefined
    | string
    | boolean
    | Function
    | DocumentFragment
    | UnevaluatedFragment
    | Element
    | Node
    | unknown
    | number
    | { type: string; value: string };

/**
 * Represents a DocumentFragment that is not inserted in the main DOM yet.
 * It has placeholders Node that will be replaced by real nodes when the fragment is evaluated.
 * These nodes are stored inside the `subtrees` object and identified using the data-vui-placeholder-id attribute.
 *
 * It also contains properties that will be set on the nodes when the fragment is evaluated.
 * These properties are stored inside the `propertiesToSet` object. The node <-> property mapping is done using `data-vui-node-id-${id}` attribute.
 */
export type UnevaluatedFragment = {
    fragment: DocumentFragment;
    subtrees: Record<string, Node>;
    propertiesToSet: Record<string, { name: string; value: unknown }>;
};

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
                console.warn(
                    "Available expressions:",
                    unevaluatedFragment.subtrees
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
    for (const [nodeId, propertyKVpair] of Object.entries(attributes)) {
        const node = fragment.querySelector(`[data-vui-node-id-${nodeId}]`);
        if (node) {
            const { name, value } = propertyKVpair;
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
    const clonedExpressions: Record<string, Node> = {};
    for (const [key, node] of Object.entries(unevaluatedFragment.subtrees)) {
        clonedExpressions[key] = node.cloneNode(true);
    }
    return {
        fragment: clonedFragment,
        subtrees: clonedExpressions,
        propertiesToSet: unevaluatedFragment.propertiesToSet,
    };
}

//#region CSS

type CSSResult = {
    cssText: string;
    styleSheet: CSSStyleSheet | undefined;
};

const cssSheetCache: Record<string, CSSStyleSheet> = {};

export function css(
    raw: TemplateStringsArray,
    ...expressions: (AllowedExpressions | AllowedExpressions[])[]
): CSSResult {
    const templatedString = String.raw(raw, ...expressions);
    return {
        cssText: templatedString,
        styleSheet: undefined, // Lazy evaluation
    };
}

export function getStylesheet(cssResult: CSSResult): CSSStyleSheet {
    if (cssResult.styleSheet) {
        return cssResult.styleSheet;
    }
    const cached = cssSheetCache[cssResult.cssText];
    if (cached) {
        cssResult.styleSheet = cached;
        return cached;
    }
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(cssResult.cssText);
    cssResult.styleSheet = styleSheet;
    cssSheetCache[cssResult.cssText] = styleSheet;
    return styleSheet;
}
