export namespace VUI {
	export abstract class Component extends HTMLElement {
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

		renderHTML(): void {
			if (!this.shadowRoot) return;
			const tree = this.render();
			applyDiff(this.shadowRoot, tree);
			this.postRender(this.shadowRoot);
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
		abstract render(): DocumentFragment;

		/**
		 * Called after each rendered to manipulate the DOM to change attributes, add event listeners, etc.
		 */
		postRender(shadowRoot: ShadowRoot): void {}
	}

	export function register(name: string) {
		return function (target: typeof Component) {
			if (!customElements.get(name)) {
				customElements.define(
					name,
					target as unknown as CustomElementConstructor
				);
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
	...expressions: AllowedTemplateExpressions[]
): DocumentFragment {
	// Resolve false, undefined and null to empty strings
	const e = expressions.map((e) => {
		if (e === null || e === undefined || e === false) return "";
		return e;
	});

	// Start by merging the expressions and the raws in one array without interpreting.
	const baseArray: AllowedTemplateExpressions[] = [];
	for (let i = 0; i < raw.length; i++) {
		baseArray.push(raw[i]);
		if (i < e.length) {
			baseArray.push(e[i]);
		}
	}
	const flatArray: AllowedTemplateExpressions[] = [];
	for (const item of baseArray) {
		if (item instanceof Array) {
			flatArray.push(...item);
		} else {
			flatArray.push(item);
		}
	}

	const template = document.createElement("template");
	const nodeFunctionMap: Record<
		string,
		{ eventName: string; action: (this: Element, ev: Event) => void }
	> = {};

	let result: (string | Node)[] = [];
	for (let i of flatArray.keys()) {
		const currentExpression = flatArray[i];
		if (currentExpression instanceof Node) {
			result.push(currentExpression);
			continue;
		}
		if (currentExpression instanceof DocumentFragment) {
			for (const child of currentExpression.children) {
				result.push(child);
			}
			continue;
		}
		if (typeof currentExpression !== "function") {
			result.push(String(currentExpression));
			continue;
		}
		const previousExpression = flatArray[i - 1];
		if (!previousExpression || typeof previousExpression !== "string") {
			// If the previous expression is not a string, we cannot extract an event name (and the templating is not valid)
			console.warn(
				`Invalid template syntax at index ${i}: expected a string before a function, got "${previousExpression}"`
			);
			result.push(String(currentExpression));
			continue;
		}
		const { eventName, strippedNodeString } =
			extractEventNameFromNodeString(previousExpression);
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

		result.pop();
		result.push(strippedNodeString + ` data-vui-node-id-${i} `);
		nodeFunctionMap[i] = {
			action: currentExpression as (this: Element, ev: Event) => void,
			eventName: eventName,
		};
	}

	// Build the object from the strings and the nodes
	let currentString: string[] = [];
	for (let i of result.keys()) {
		if (typeof result[i] === "string") {
			currentString.push(result[i]);
			continue;
		}
		currentString.push(`<span data-vui-placeholder-id="${i}"></span>`);
	}
	template.innerHTML = currentString.join("");

	// Replace the placeholders with the actual nodes
	const placeholders = template.content.querySelectorAll(
		"[data-vui-placeholder-id]"
	);
	for (const p of placeholders) {
		const elementId = parseInt(
			p.getAttribute("data-vui-placeholder-id") || "",
			10
		);
		if (isNaN(elementId)) {
			p.remove();
		}
		const realElement = result[elementId];
		if (!realElement) {
			console.warn(
				`Placeholder with id ${elementId} not found in the result array. This indicate a malformed template.`
			);
			p.remove();
		} else {
			p.replaceWith(realElement);
		}
	}

	// Bind all the events to the nodes and remove the `vui-node-id` attribute
	for (const [nodeId, eventInfo] of Object.entries(nodeFunctionMap)) {
		const node = template.content.querySelector(`[data-vui-node-id-${nodeId}]`);
		if (node) {
			node.addEventListener(eventInfo.eventName, eventInfo.action);
			node.removeAttribute(`data-vui-node-id-${nodeId}`);
		}
	}
	return template.content;
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

function getKeyOr(node: ChildNode, defaultKey: string) {
	if (node instanceof Element) {
		return node.getAttribute("data-key") ?? defaultKey;
	}
	return defaultKey;
}

function applyDiff(
	originalDom: DocumentFragment | Node,
	newElements: DocumentFragment | Node
) {
	const originalChildren = Array.from(originalDom.childNodes);
	const newChildren = Array.from(newElements.childNodes);

	const keyedOriginals = new Map<string, ChildNode>();
	originalChildren.forEach((child, index) => {
		keyedOriginals.set(getKeyOr(child, String(index)), child);
	});

	newChildren.forEach((newChild, index) => {
		const key = getKeyOr(newChild, String(index));
		const originalChild = key
			? keyedOriginals.get(key)
			: originalChildren[index];

		if (originalChild) {
			diffNodes(originalChild, newChild);
			if (key) keyedOriginals.delete(key);
		} else {
			originalDom.appendChild(newChild);
		}
	});

	keyedOriginals.forEach((node) => node.remove());
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

function diffNodes(originalNode: Node, newNode: Node) {
	if (
		newNode.nodeType === Node.TEXT_NODE &&
		originalNode.nodeType === Node.TEXT_NODE
	) {
		if (originalNode.textContent !== newNode.textContent) {
			originalNode.textContent = newNode.textContent;
		}
		return;
	}

	// If they are elements, diff attributes and children
	if (
		originalNode instanceof Element &&
		newNode instanceof Element &&
		originalNode.tagName == newNode.tagName
	) {
		diffAttributes(originalNode, newNode);
		applyDiff(originalNode, newNode); // Recurse on children
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
function extractEventNameFromNodeString(nodeString: string): {
	eventName: string;
	strippedNodeString: string;
} {
	// Find the last occurrence of '@' and the next '=' after it
	const atIdx = nodeString.lastIndexOf("@");
	if (atIdx === -1) return { eventName: "", strippedNodeString: nodeString };
	const eqIdx = nodeString.indexOf("=", atIdx);
	if (eqIdx === -1) return { eventName: "", strippedNodeString: nodeString };
	const eventName = nodeString.slice(atIdx + 1, eqIdx).trim();
	return { eventName, strippedNodeString: nodeString.slice(0, atIdx) };
}
