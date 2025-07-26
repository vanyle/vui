import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./toggle";

const meta: Meta = {
    component: "vui-toggle",
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
    args: {
        selected: "Apple",
        options: ["Apple", "Banana", "Cherry"],
    },
};
