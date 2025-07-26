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
    test: {
        globals: true,
        environment: "jsdom",
    },
    build: {
        lib: {
            name: "vui",
            formats: ["umd"],
            entry: [resolve(__dirname, "src/main.mts")],
            fileName: "vui",
        },
        minify: true,
        modulePreload: {
            polyfill: false,
        },
        rollupOptions: {},
    },
    esbuild: {
        target: "es2022",
    },
});
