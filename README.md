# Vui

Vui is a frontend framework to build fast responsive websites.
Vui uses web components and Lit's syntax to display the page.

It is interoperable with every other framework like Vue, React, Angular, etc...

It is simpler and lighter than Lit while providing 90% of the features. In fact, you can use VSCode's lit extension to get autocompletion and syntax highlighting!

## ✈️Overview✈️

Example of a simple component:
```ts
@VUI.register("my-counter")
class Counter extends VUI.Component{
	@attribute()
	count: number = 0;

	@attribute()
	heading: string = "Counter";

	render(){
		return html`
			<h1>${this.heading}</h1>
			<div>Counter: ${this.count}</div>
			<button @click=${() => this.onClick()}>Click me!</button>
		`;
	}
	onClick(){
		this.count += 1;
	}

	static style = css`
		h1 {
			color: blue;
		}
		button {
			background-color: lightblue;
			border: none;
			padding: 10px;
			cursor: pointer;
		}
	`
}
```

Using the component inside another component

```html
<my-counter title="Counter!" count="5"/>
```

## ✨Features✨

### Component Based

Split your app into independent reusable components.
You can share theses components between projects with no dependencies.

Once compiled, the components just look like regular `.js` files. Moreover, compiled components remain small.

### Compatible with every other framework

VUI components can be used in every place where you can have a DOM like electron, the browser, etc...

You can import components into existing projects and use them using regular HTML tags.

### No dependencies

Vui has no dependencies, it is a single file that you can include in your project.
It works with all bundlers and all typescript / javascript configurations.

### Fast

Vui uses native web components and a simple DOM diffing system to update the page with no virtual DOM.

## Cool premade components

You can find some premade components in the `/components` folder to get started quickly on your new project!
Or integrate them into your existing project!

## 📚 Documentation 📚

You can checkout more component examples in `/examples`.
A detailled guide will be available in [DOC.md](blob/master/DOC.md)

## ❓Want to help❓

Star the project, it gives me motivation.