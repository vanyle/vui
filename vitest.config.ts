import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [],
    test: {
        browser: {
            enabled: false,
        },
    },
});
