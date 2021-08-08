// Vanyle UI Library.
// This is a compiler for vui files

/*

Usage:

let vui = require('vui');

vui.fromString(component_name,vui_component_string);
vui.fromFile("path/to/component.vui"); // component is the name of the component

// vui bundles every component into a simple javascript file.
// This file is reusable for other projects and can then be used without vui (a bit like a static library in C++)
fs.writeFileSync("compiled.js",vui.output());


let list = make("todo-list",{todo:["Apple","Banana","Oranges"]});
// or
<todo-list todo="['Apple','Banana','Oranges']"/>

*/


// goal: no dependencies.
// we have a custom xml parser and the specs make it so that
// we don't have to do fancy javascript transformations
const fs = require("fs");
const path = require("path");


let vui_table = {}; // needed to solve dependencies between components
function fromFile(path_string){
	let component_name = path.basename(path_string).split('.').slice(0, -1).join('.');
	fromString(component_name,fs.readFileSync(path_string,"utf8"));
}
function fromString(vui_component_name,vui_string){
	// convert the component_name to a valid js function name:

	vui_component_name = vui_component_name.replace(/\-/g,"_");

	vui_table[vui_component_name] = vui_string;
}

// Real parsing starts here.


// <name property=value > Stuff ... </name> OtherStuff
/*
[
	{
		name:'name',
		properties:[
			{
				name:'property',
				value:'value'
			}
		],
		content:[
			"Stuff"
			// ...
		]
	},
	"OtherStuff"
]

*/

const autoSelfclosing = {
	"link":true,
	"meta":true,
	"img":true,
	"input":true,
	"embed":true,
	"hr":true,
	"track":true,
	"source":true
}
const escapeTable = {
	"n":"\n",
	"r":"\r",
	"t":"\t",
	"0":"\0",
	"\\":"\\",
	"\"":"\"",
	"\'":"\'"
}

function xmlRecursive(source,customHandlerObject,startIndex){
	let currentString = "";
	let result = [];
	let i = startIndex;
	let inComment = false;
	let error = null;

	while(i < source.length){

		if(inComment){
			if(source.substring(i,i+"-->".length) === "-->"){
				inComment = false;
				i += "-->".length;
			}else{
				i++;
				continue;
			}
		}

		if(source.substring(i,i+"<!--".length) === "<!--"){
			inComment = true;
			i += "<!--".length;
		}else if(source[i] === "<" && source[i+1] === "/"){
			// closing tag, ending recursive call
			break;
		}else if(source[i] === "<"){
			let trimed = currentString.trim();
			if(trimed !== ""){
				result.push(trimed);
				currentString = "";
			}
			let obj = parseTag(source,customHandlerObject,i+1);
			error = error || obj.error;
			i = obj.i;
			result.push(obj.result);
		}else{
			currentString += source[i];
		}
		i++;
	}
	let trimed = currentString.trim();
	if(trimed !== ""){
		result.push(trimed);
	}

	return {result,error,i}
}
function parseAttributeValue(source,startIndex){
	// Stuff that we want to parse:
	// "value2 with >> \"backticked quotes\""
	// value_without_quotes
	// stop at the position of a " " or a ">" or a "/>"
	let i = startIndex;
	let quoteType = source[i];
	let value = "";

	if(quoteType !== "'" && quoteType !== '"'){
		quoteType = false;
	}else{
		i += 1;
	}
	if(quoteType){
		let isEscaped = false;
		while((source[i] !== quoteType || isEscaped) && i < source.length){
			if(source[i] === "\\"){
				isEscaped = true;
			}else if(!isEscaped){
				value += source[i];
			}else{
				// handle escaped sequences.
				if(escapeTable[source[i]] !== undefined){
					value += escapeTable[source[i]];
				}
				isEscaped = false;
			}
			i++;
		}
	}else{
		while(source[i].trim() !== "" && source[i] !== ">" && source[i] !== "/" && i < source.length){
			value += source[i];
			i++;
		}
	}
	return {result:value,i};
}
function parseTag(source,customHandlerObject,startIndex){
	// at startIndex, we have for example: xml-name property="value"> ... </xml-name>
	let i = startIndex;
	let result = {name:"",properties:[]};
	let error = null;

	// Parse the name
	while(source[i].trim() !== "" && source[i] !== "/" && source[i] !== ">" && i < source.length){
		i++;
	}
	let name = source.substring(startIndex,i);
	result.name = name;

	// Parse the properties
	// property=value property2="value2 with >> \"backticked quotes\"">
	let isSelfClosing = false;
	
	let currentPropertyName = "";

	while(i < source.length && source[i] !== "/" && source[i] !== ">"){
		if(source[i] !== "=" && source[i].trim() !== ""){
			currentPropertyName += source[i];
		}else if(source[i] === "="){
			i += 1;
			let obj = parseAttributeValue(source,i);
			i = obj.i;
			result.properties.push({
				name: currentPropertyName,
				value: obj.result
			});
			if(source[i] === ">") i--;

			currentPropertyName = "";
		}else if(source[i].trim() === "" && currentPropertyName.trim() !== ""){
			result.properties.push({
				name: currentPropertyName,
				value: null
			});
			currentPropertyName = "";
		}
		i++;
	}
	if(currentPropertyName.trim() !== ""){
		result.properties.push({
			name: currentPropertyName,
			value: null
		});
	}

	isSelfClosing = source[i] === "/";
	if(!isSelfClosing && autoSelfclosing[name.toLowerCase()]){
		// <link ... > is also self closing despite not being proper XML.
		// (But it's inside the HTML5 standard ...)
		isSelfClosing = true;
		i -= 1; // go back to compensate for the lack of / in />
	}


	if(isSelfClosing){
		i += 2; // eat />
		result.content = null;
	}else{
		// Parse the content
		i += 1;
		if(
			typeof customHandlerObject === 'object' &&
			customHandlerObject !== null &&
			typeof customHandlerObject[name] === "function"){

			// let the custom handlet do the thing.
			let subSouceContent = "";
			let stopToken = `</${name}>`;
			let startIndex = i;
			while(i < source.length){
				if(source.substring(i,i+stopToken.length) === stopToken){
					break;
				}
				i++;
			}
			if(i >= source.length-1){
				// Complain !
				error = `Incorrect HTML, "</${name}> never found !"`;
			}
			result.content = customHandlerObject[name](source.substring(startIndex,i-1));
			i += stopToken.length;
		}else{
			let obj = xmlRecursive(source,customHandlerObject,i);
			result.content = obj.result;
			error = error || obj.error;

			i = obj.i;
			// eat the closing tag.
			let closingName = "";
			while(i < source.length && (source[i] === "<" || source[i] === "/")){
				i++;
			}
			while(i < source.length){
				if(source[i] == ">"){
					break;
				}else{
					closingName += source[i];
				}
				i++;
			}
			// report error if closingName != name
			if(closingName != name){
				error = `Incorrect HTML, "</${closingName}>" encountered instead of "</${name}>"`;
			}else if(i >= source.length-1){
				// Complain !
				error = `Incorrect HTML, "</${name}> never found !"`;
			}
		}
	}

	return {result,error,i};
}
function xmlParser(source){
	return xmlRecursive(source,{
		style: (s) => s,
		script: (s) => s
	},0);
}
function htmlParser(source){
	// split source into style, template and script
	let obj = xmlParser(source);
	return obj;
	// convert template to javascript code.
}

// Converts templated strings like {{ todo[i] }} into JS code
// that returns their value: data.todo[i]
// The code generated contains eval.
function resolveString(str,pad){
	let result = `(() => {\n`;
	let bpad = pad + "\t";
	result += `${bpad}let res = "";\n`;
	let stringBits = [];

	let lastBreakIndex = 0;

	// divide str into {{ and }} bits
	let inCode = false;

	for(let i = 0;i < str.length;i++){
		if(str.substring(i,i + 2) === "{{"){
			if(inCode){
				console.error(`Incorrect template: {{ encountered inside of code in ${str}`);
			}
			stringBits.push(str.substring(lastBreakIndex,i));
			lastBreakIndex = i + 2;
			inCode = true;
		}else if(str.substring(i,i + 2) === "}}"){
			if(!inCode){
				// complain.
				console.error(`Incorrect template: }} encountered outside of code in ${str}`);
			}
			stringBits.push({
				code: str.substring(lastBreakIndex,i)
			});
			lastBreakIndex = i + 2;
			inCode = false;
		}
	}
	if(inCode){
		console.error(`Incorrect template: {{ was never closed in ${str}`);
	}

	stringBits.push(str.substring(lastBreakIndex,str.length)); // flush.

	for(let i = 0;i < stringBits.length;i++){
		if(typeof stringBits[i] === "string"){
			if(stringBits[i] !== ""){
				result += `${bpad}res += ${JSON.stringify(stringBits[i])};\n`;
			}
		}else{
			result += `${bpad}res += ${stringBits[i].code};\n`;
		}
	}


	result += `${bpad}return res;\n${pad}})()`;
	return result;
}

// return js source code, recursive
// We assume a data variable is in scope to generate all the HTML.

// Performance note: Returning the HTML source + using innerHTML might be faster in some cases.
// We need to do both.
function htmlToJs(html_tree,pad){
	if(typeof html_tree === "string"){
		return html_tree;
	}
	// Handle special HTML tags that generate JS.
	let tagName = html_tree.name;
	let result = "";
	let real = true;

	function makeBody(){
		let result = "";
		let stringContentBuffer = "";
		result += `${pad}currentDomElement = e;`;
		
		for(let i = 0;i < html_tree.content.length;i++){
			let e = html_tree.content[i];
			if(typeof e === "string"){
				stringContentBuffer += e;
				continue;
			}else if(stringContentBuffer !== ""){
				// string content merging for better perf + cleaner code.
				result += `${pad}{\n${pad}\nlet n = document.createTextNode(${resolveString(stringContentBuffer,pad)});\n`;
				result += `${pad}\ne.appendChild(n);\n${pad}}\n`;
				stringContentBuffer = "";
			}

			result += `${pad}((parent)=>{\n`; // rename e to parent for the innerScope
			let jsSubtree = htmlToJs(e,pad+"\t");
			result += jsSubtree.result;
			// no need to append if the elemement below is "fake" aka an if/for tag.
			if(jsSubtree.real){
				result += `${pad}parent.appendChild(e);\n`;
			}
			result += `${pad}})(e);\n`;
		}

		// buffer flush.
		if(stringContentBuffer !== ""){
			// string content merging for better perf + cleaner code.
			result += `${pad}{\n${pad}let n = document.createTextNode(${resolveString(stringContentBuffer,pad)});\n`;
			result += `${pad}e.appendChild(n);\n${pad}}\n`;
		}
		return result;
	}


	if(tagName === "for"){

		result += `${pad}for(${html_tree.properties[0].value};${html_tree.properties[1].value};${html_tree.properties[2].value}){\n`;
		result += makeBody();
		result += `${pad}}\n`;
		real = false;
	}else if(tagName === "if"){
		result += `${pad}if(${html_tree.properties[0].value}){\n`;
		result += makeBody();
		result += `${pad}}\n`;
		real = false;
	}else{
		// handle nested custom elements.
		let asJsFn = tagName.replace(/\-/g,"_");
		if(vui_table[asJsFn]){
			// extract attributes into an object and pass it as argupment.
			let customData = {};
			for(let i = 0;i < html_tree.properties.length;i++){
				let p = html_tree.properties[i];
				// TODO: apply resolveString to p.value 
				customData[p.name] = p.value; // discard repeats.
			}
			result += `${pad}let e = make_${asJsFn}(${JSON.stringify(customData)});`;


		}else{

			result += `${pad}let e = document.createElement(${JSON.stringify(tagName)});\n`;
			// Create a local lambda function that will setup the element and call it on update.
			result += `${pad}let generator = () => {\n${pad}e.innerHTML = "";`;
			for(let i = 0;i < html_tree.properties.length;i++){
				let p = html_tree.properties[i];
				// we can do special things for some properties !
				result += `${pad}e.setAttribute(${JSON.stringify(p.name)},${JSON.stringify(p.value)});\n`;
			}
			result += makeBody();
			result += `${pad}};` // end of generator function.
			result += `generator();\n`;
			result += `${pad}e.addEventListener("update",generator);`;
		}
		real = true;
	}

	return {result,real};
}

function uniqueString(l){
	let r = "";
	let charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	for(let i = 0;i < l;i++){
		r += charset[(Math.floor(Math.random() * charset.length))];
	}
	return r;
}

let classCache = {}; // object to make sure the class of every element is unique.

function output(){
	// generate js function from vui component.
	let result = fs.readFileSync("./vui-base.js","utf-8");


	for(let component in vui_table){

		let htmlString = vui_table[component];
		let parsed = htmlParser(htmlString);
		let error = parsed.error;
		let tree = parsed.result;

		if(error !== null){
			console.error(`Unable to generate component file for ${component}, bad HTML syntax: ${error}`);
			continue;
		}

		// Handle the style, the script and the template separately.
		let template_tree = null;
		let style_string = null;
		let script_string = null;

		for(let i = 0;i < tree.length;i++){
			if(tree[i].name === "template"){
				template_tree = tree[i].content[0];
			}else if(tree[i].name === "style"){
				style_string = tree[i].content;
			}else if(tree[i].name === "script"){
				script_string = tree[i].content;
			}
		}

		if(template_tree === null){
			console.error(`Unable to find a template (<template></template>) for ${component}.`);
			continue;
		}

		let jsSource = htmlToJs(template_tree,"\t");

		if(!jsSource.real){
			console.error(`The root element of a template cannot be for / if ! Skipping ${component}`);
			continue;
		}

		// Everything seems ok, let's make the component !
		result += `function make_${component}(componentDataContent){\n`;

		// generate a unique class for the component
		// This class will act as an id for this type of component.
		// uniqueString should be more deterministic so that compilation is deterministic!
		let cclass = uniqueString(16);
		while(typeof classCache[cclass] !== "undefined"){
			cclass = uniqueString(16);
		}
		classCache[cclass] = true;

		// load style on first call.
		// generate a style element targeting the class.
		// replace [current-component] with .${cclass} in the style string:

		style_string = style_string.replace(/\[current-component\]/g,"."+cclass);
		result += `
	"use strict";
	if(typeof make_${component}.firstCall === "undefined"){
		make_${component}.firstCall = false;
		let sheet = document.createElement('style');
		sheet.innerHTML = ${JSON.stringify(style_string)};
		document.body.appendChild(sheet);
	}\n`;

		result += script_string;// add local script functions.

		// we are ready to call load !
		// this will initialize data, so that it can be used.
		// this can be used to give default values to data for example.
	result += `
	componentDataContent = componentDataContent || {};
	(load || (()=>{}))(componentDataContent);
`;
		
		// componentDataContent is ready to be used, add watchers:
result += `
	let domUsageTable = {};
	let currentDomElement = null;
	let loading = true;
	let handler = {
		get: (target,prop,receiver) => {
			if(currentDomElement !== null && loading){
				if(typeof domUsageTable[prop] === "undefined"){
					domUsageTable[prop] = [];
				}
				domUsageTable[prop].push(currentDomElement);
			}
			return componentDataContent[prop];
		}
	};
	let handler2 = {
		get: (target,prop,receiver) => {
			if(!loading){
				// Still dispatch event as it might be a method call.
				if(domUsageTable[prop]){
					for(let i = 0;i < domUsageTable[prop].length;i++){
						setTimeout(()=>{
							domUsageTable[prop][i].dispatchEvent(new CustomEvent("update", componentDataContent));
						},0);
					}
				}
			}
			return componentDataContent[prop];
		},
		set: (target,prop,value,receiver) => {
			let tmp = (componentDataContent[prop] = value);
			if(domUsageTable[prop]){
				for(let i = 0;i < domUsageTable[prop].length;i++){
					domUsageTable[prop][i].dispatchEvent(new CustomEvent("update", componentDataContent));
				}
			}
			return tmp;
		}
	}
	let proxy = new Proxy(componentDataContent,handler);
	let outputProxy = new Proxy(componentDataContent,handler2);
`;

		result += `let e = ((data) => {
	${jsSource.result}
	loading = false;
	e.addEventListener("click",() => {
		if(typeof click === "function"){
			click(outputProxy);
		}
	});
	return e;
	})(proxy);
	if(typeof postload === "function"){
		postload(e,outputProxy);
	}
`;

		result += `	e.className += ${JSON.stringify(" "+cclass)};\n`;
		result += `	e.data = outputProxy;`;
		result += `	return e;\n}\n\n`;


	}

	return result;
}

module.exports = {
	fromFile,
	fromString,
	output,

	// exported for testing:
	xmlParser,
	htmlParser,
	htmlToJs
};