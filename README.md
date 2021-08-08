# VUI

VUI is a frontend framework to build fast responsive websites.
VUI is based on a compiler so that when the page loads, no javascript
has to run to display the page (besides content that has to load through AJAX requests)

This means that VUI is faster than most common frameworks like
- Vue
- React
- Angular
- ...

Indeed, VUI compiles your code into HTML+CSS+Javascript that remains
readable but fast as the DOM structure of your website is recompiled.

This gives you the benefits of static vanilla HTML websites with the flexibility
and syntax sugar of javacript frameworks with components.

## Features

### Component Based

Split your app into independent reusable components.
You can share theses components between projects with no dependencies.

Once compiled, the components just look like regular `.js` files. Moreover, compiled components remain small.

### Compatible with every other framework

VUI components can be used in every place where you can have a dom:
electron, the browser, etc...

You can import components into existing projects with `import`, `<script>` tags or `require`.

### No dependencies

VUI is totally independent from every other package. You just install the compiler and you can
write your modules anywhere. There is just one package that does the job (and it's small).

This makes compilation fast and babel free.

### Fast

VUI precompiles your pages and your components. This speeds up rendering while adding no bloat to your pages.

## Overview

Example of a simple component:
```html
<style> /* Style is local to the component */
	[current-component] > h1{
		color:red;
	}
</style>
<template>
	<div>
        <h1> {{ title }}</h1>
        <div>Counter: {{ data.count }}</div>
	</div>
</template>
<script>
	function load(data){
		data.count = data.count || 0;
	}
	function click(){
		data.count += 1;
	}
</script>
```

Using the component inside another component (requires the compiler)

```html
<counter title="Counter!" count="5"/>
```

Using the component inside JS:

```html
<script src="/path/to/counter.js"></script>
<script>
    // let counter_component = require("/path/to/counter.js");
    
	let counter = counter_component({title:"Counter!",count:5});
    document.body.appendChild(counter); // counter is a vanilla HTML Element.
</script>

```


You should be familiar with this syntax if you used Vue components.

Compile with:
```bash
vui path/to/my/component.vui path/to/the/compiled/file.js
```

You can bundle multiple components into one file. This is required if you have dependencies between components:
```bash
vui path/to/my/components/ path/to/the/bundle.js
```

## Documentation

You can checkout more component examples in `/examples`.

## VBel2 integration

[VBel2](https://github.com/vanyle/vbel2) is a backend library for Node.js
We provide special features to write components that work well with the Websockets to have
reactivity.

```html
<style>

</style>
<template>
	<div>
		{{ data.likes }} likes
	</div>
</template>
<script>
	function load(data){
		data.likes = data.likes || 0;
	}
</script>
```