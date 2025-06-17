import { resolve } from "path";
import { defineConfig } from "vite";
// @ts-ignore
import dts from "unplugin-dts/vite";

export default defineConfig({
	plugins: [
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			entryRoot: "src",
		}),
	],
	build: {
		lib: {
			name: "vui",
			formats: ["es"],
			entry: [
				resolve(__dirname, "src/vui.mts"),
				resolve(__dirname, "examples"),
			],
			fileName: "vui",
		},
		minify: true,
		modulePreload: {
			polyfill: false,
		},
	},
	esbuild: {
		target: "es2022",
	},
});
