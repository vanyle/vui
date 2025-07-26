<h1 align="center">VUI</h1>

<p align="center">
  <i>A frontend framework to build fast, responsive, accessible websites.</i>
</p>
<p align="center">
  <a href="https://github.com/vanyle/vui/"><img src="https://img.shields.io/github/stars/vanyle/vui?style=social" alt="GitHub Stars"></a>
  <img src="https://github.com/vanyle/vui/actions/workflows/test.yml/badge.svg" alt="github test badge"/>
</p>

## 🎉 Features

-   Based on native [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
-   Interoperable with every other framework like Vue, React, Angular, etc...
-   Uses the same syntax as [Lit](https://lit.dev) while being simpler and lighter. You can use the same autocompletion and syntax highlighting as Lit.
-   Components based to allow you to split your rendering logic into simple, testable, composable and reusable pieces.
-   No build step or bundling step required. Vui can be included in existing JavaScript / TypeScript any project. See `index.html` as an example

## ✈️ Overview

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

## 📚 Documentation

You can checkout more component examples in `/examples`.
Vui uses the same syntax and tries to match [Lit](https://lit.dev/)'s behavior

## 🧪 Testing

Components can be unit tested using `vitest`, see the `__tests__` folder as an example.
You can also use playwright for integration testing, but unlike Lit, you don't have to.

## ❓ Want to help

Ranked by difficulty

-   Drop a ⭐Star!
-   Try use it for your next project
-   Contribute a test inside `__tests__`
-   Contribute a component inside `examples`
