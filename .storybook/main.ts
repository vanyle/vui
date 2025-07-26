import type { StorybookConfig } from "@storybook/web-components-vite";

const config: StorybookConfig = {
    stories: [
        "../examples/**/*.stories.@(js|jsx|mjs|ts|tsx|mts|cjs)",
        "../src/**/*.stories.@(js|jsx|mjs|ts|tsx|mts|cjs)",
    ],
    addons: [
        "@storybook/addon-docs",
        "@storybook/addon-a11y",
        "@storybook/addon-vitest",
    ],
    framework: {
        name: "@storybook/web-components-vite",
        options: {},
    },
};
export default config;
