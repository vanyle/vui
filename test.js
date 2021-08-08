const vui = require("./index.js");
const fs = require("fs");


// Some very simple XML parsing tests for the parser
test("Parses simple html", () => {
	let htmlString = `
		<div>
			<ul>
				<li><i>Element</i> 1</li>
				<li><em>Element</em> 2</li>
				<li>Element 3</li>
			</ul>
			Text in the middle
			<p>
				Some text
			</p>
		</div>
	`;
	let {result,error} = vui.xmlParser(htmlString);
	
	expect(error).toBe(null);
	expect(result.length).toBe(1);

	expect(result[0].name).toBe("div");
	expect(result[0].content.length).toBe(3); // ul, text in the middle, p
	expect(result[0].content[2].content[0]).toBe("Some text");

	expect(result[0].content[1]).toBe("Text in the middle");
	
	expect(result[0].content[0].content.length).toBe(3); // ul has 3 childs

	expect(result[0].content[0].content[0].content[0].content[0]).toBe("Element");
	expect(result[0].content[0].content[0].content[1]).toBe("1");

});
test("Ignore things inside comments", () => {
	let htmlString = `
		<p>A paragraph</p>
		<!-- This is a comment <a>I'm ignored.</a> -->
		<article>I'm an article</article>
	`;
	let {result,error} = vui.xmlParser(htmlString);

	expect(result.length).toBe(2);
	expect(result[0].name).toBe("p");
	expect(result[1].name).toBe("article");
});

test("Complains when tags are not closed", () => {
	let htmlString = `
		<div>
		<p>
		<h1>Title</h1>
		<p> <!-- Oops -->
		</div>
	`;
	let {result,error} = vui.xmlParser(htmlString);
	expect(error).not.toBe(null);

	htmlString = `
		<div>
		<p>
		<h1>Title</h1>
		<p> <!-- Oops -->
	`;

	let {result2,error2} = vui.xmlParser(htmlString);
	expect(error2).not.toBe(null);

});

test("Knows that some tags are self closing", () => {
	let htmlString = `
		<html>
			<head>
				<link href="style.css">
				<meta charset="utf8">
			</head>
			<body>
				<input> <!-- No closing tag required. -->
			</body>
		</html>
	`;
	let {result,error} = vui.xmlParser(htmlString);
	expect(error).toBe(null);
});

test("Converts html to javascript code", () => {
	let htmlString = `
		<div>
			<style>
				a{
					color:red;
				}
			</style>
			<script>
				for(let i = 0;i < 10;i++){
					console.log(i);
				}
			</script>
			<ul>
				<li><i>Element</i> 1</li>
				<li><em>Element</em> 2</li>
				<li>Element 3</li>
			</ul>
			Text in the middle
			<p>
				Some text
			</p>
		</div>
	`;
	let {result,error} = vui.htmlParser(htmlString);
	expect(error).toBe(null);

	let js = vui.htmlToJs(result[0],"");
	expect(true).toBe(true);
});

test("Handles empty html attributes", () => {
	let htmlString = `
		<section style></section>
		<section style ></section>
	`;
	
	let {result,error} = vui.xmlParser(htmlString);

	expect(result[0].properties[0].value).toBe(null);
	expect(result[0].properties[0].name).toBe("style");
	
	expect(result[1].properties[0].value).toBe(null);
	expect(result[1].properties[0].name).toBe("style");
});

test("Parses html attributes", () => {
	let htmlString = `
		<section style="color:red;">
			<button onclick=alert(1)>Click</button>
			<input
				data-value="412"
				value=412
				placeholder="Enter your favorite number"
			/>
		</section>
	`;
	let {result,error} = vui.xmlParser(htmlString);
	let obj = result[0];


	expect(obj.properties[0].value).toBe("color:red;")
	expect(obj.properties[0].name).toBe("style");

	let button = obj.content[0];

	expect(button.name).toBe("button");
	expect(button.properties[0].name).toBe("onclick");
	expect(button.properties[0].value).toBe("alert(1)");
	expect(button.content[0]).toBe("Click");

	let input = obj.content[1];

	expect(input.name).toBe("input");
	expect(input.content).toBe(null);
	expect(input.properties[0].name).toBe("data-value");
	
	expect(input.properties[1].name).toBe("value");
	expect(input.properties[1].value).toBe("412");
	
	expect(input.properties[2].name).toBe("placeholder");

});
test("Parses strings with escaped quotes", () => {
	let htmlString = `
		<img src="Hello, \\"world\\""/>
		<p>Some Text</p>
	`;

	let {result,error} = vui.xmlParser(htmlString);
	expect(result[0].name).toBe("img");
	expect(result[0].properties[0].name).toBe("src");
	expect(result[0].properties[0].value).toBe(`Hello, "world"`);
	expect(result[0].properties.length).toBe(1);

	expect(result[1].name).toBe("p")
	expect(result[1].properties.length).toBe(0);

});

// Now, use the examples as tests

test("Generates a javascript function from a vui file", () => {

	vui.fromFile("./examples/counter.vui");
	vui.fromFile("./examples/todo-list.vui");

	fs.writeFileSync("compiled_component.js",vui.output());

	expect(true).toBe(true);
});