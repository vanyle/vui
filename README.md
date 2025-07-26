# Vui

Vui is a frontend framework to build fast, responsive, accessible websites.
It uses web components and Lit's syntax to display the page.

It is interoperable with every other framework like Vue, React, Angular, etc...

Components allow you to split your rendering logic into simple, testable, composable and reusable pieces.

It is simpler and lighter than Lit while providing 90% of the features. In fact, you can use VSCode's lit extension to get autocompletion and syntax highlighting!

Unlike Lit, Vui requires no build step or bundling step and can be included in existing JavaScript / TypeScript any project. See `index.html` as an example

## ✈️Overview✈️

Example of a simple component:

```ts
@customElement("my-counter")
class Counter extends VUI.Component {
    @state()
    accessor count: number = 0;

    @attribute({ name: "heading" })
    accessor heading: string = "Counter";

    render() {
        return html`
            <div>${this.heading} ${this.count}</div>
            <button @click=${() => this.onClick()}>Click me!</button>
        `;
    }
    onClick() {
        this.count += 1;
    }

    // add override here when using typescript
    static override styles = css`
        :host {
            display: inline-flex;
        }
        :host > * {
            padding: 8px;
        }
        div {
            background-color: lightblue;
        }
        button {
            background-color: lightgreen;
            border: none;
            cursor: pointer;
        }
    `;
}
```

Using the component inside another component

```js
return html`<my-counter .heading=${Counter!} .count=${5} ></my-counter>`
```

Using the component inside HTML

```html
<my-counter heading="Counter!"></my-counter>
```

## ✨Features✨

### Component Based

Split your app into independent reusable components.
You can share theses components between projects with no dependencies.

The components are regular `.js` (or `.ts`) files.

### Compatible with every other framework

VUI components can be used in every place where you can have a DOM like electron, the browser, etc...

You can import components into existing projects and use them using regular HTML tags.

### No dependencies

Vui has no dependencies, it is a single file that you can include in your project.
It works with all bundlers and all typescript / javascript configurations.

### Fast

Vui uses native web components and a simple DOM diffing system to update the page with no virtual DOM.

## 📚 Documentation 📚

You can checkout more component examples in `/examples`.
Vui uses the same syntax and tries to match [Lit](https://lit.dev/)'s behavior

## Testing

Components can be unit tested using `vitest`, see the `__tests__` folder as an example.
You can also use playwright for integration testing, but unlike Lit, you don't have to.

## ❓Want to help❓

Ranked by difficulty

-   Drop a ⭐Star!
-   Try use it for your next project
-   Contribute a test inside `__tests__`
-   Contribute a component inside `examples`
