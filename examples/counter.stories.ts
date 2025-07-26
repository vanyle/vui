import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./counter";

const meta: Meta = {
    component: "vui-counter",
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
    args: {
        heading: "Counter ",
    },
};
