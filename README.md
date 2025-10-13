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
return html`<my-counter .heading=${"Counter!"} .count=${5}></my-counter>`;
```

Using the component inside HTML

```html
<my-counter heading="Counter!"></my-counter>
```

## 🆕 Installation

### If you are using JavaScript and no build step

If you are using pure JavaScript, you just need to include the following tag in your HTML.

```js
<script src="https://github.com/vanyle/vui/releases/download/0.0.1/vui.umd.cjs"></script>
```

### If you are using Typescript

Vui is not yet published to npm. You need to install it using its URL:

-   Using npm: `npm install https://github.com/vanyle/vui/`
-   Using pnpm: `pnpm add https://github.com/vanyle/vui/`

VUI uses [decorators](https://github.com/tc39/proposal-decorators). They are not widely supported by browsers in 2025,
so you need to add the following in your `vite.config` / `tsconfig.json` file if you want to use them.
The decorators are optional, but they make the syntax a lot nicer.

For `tsconfig.json`:

```js
{
    // ...
    "target": "es2022",

    // "experimentalDecorators" needs to be false (false is the default)
    "experimentalDecorators": false
}
```

For `vite`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
    // The rest of your config stays unchanged
    // ...
    esbuild: {
        target: "es2022", // needed for decorator support
    },
});
```

Afterwards, you can import "VUI" and use it:

```ts
import { VUI, customElement, state, attribute, html, css } from "vui";

@customElement("my-custom-component")
export class MyCustomComponent extends VUI.Component {
  ...
}
```

## 📚 Documentation

You can checkout more component examples in `/examples`.
Vui uses the same syntax and tries to match [Lit](https://lit.dev/)'s behavior

You can run `pnpm storybook` to see the examples in action. You can also use `pnpm dev` and edit `index.html` to play around with the components.

## 🧪 Testing

Components can be unit tested using `vitest`, see the `tests` folder as an example.
You can also use playwright for integration testing, but unlike Lit, you don't have to.

## ❓ Want to help

Ranked by difficulty

-   Drop a ⭐Star!
-   Try using it for your next project
-   Contribute a test inside `tests`
-   Contribute a component inside `examples`
