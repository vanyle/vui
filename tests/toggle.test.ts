import { describe, expect, it } from "vitest";
import { screen } from "shadow-dom-testing-library";
import { click, render } from "./testingUtils";
import "@testing-library/jest-dom/vitest";
import "../examples/toggle";

/**
 * @jest-environment jsdom
 */
describe("Toggle Component", () => {
    it("should toggle the state", async () => {
        await render(`<toggle-example></toggle-example>`);

        const btn = screen.getByShadowText("Option 1");
        await click(btn);

        expect(btn).toHaveClass("selected");

        const btn2 = screen.getByShadowText("Option 2");
        await click(btn2);

        expect(btn2).toHaveClass("selected");
    });
});
