# How does it work ?

We only have an tiny custom XML parser, no JS parser.

1. Parse the XML.
2. Generate a JS function that contains the script that the user provided.
3. Add watchers to the data object
4. Render the thing and note what data is used to render what element using getters.
5. When a data update occurs rerender the elements that used this data.