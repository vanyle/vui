import { describe, expect, it } from "vitest";
import { screen } from "shadow-dom-testing-library";
import { click, render } from "./testingUtils";
import "@testing-library/jest-dom/vitest";
import "../examples/counter";

/**
 * @jest-environment jsdom
 */
describe("Counter Component", () => {
    it("should increment the count", async () => {
        await render(`<my-counter heading="Test Counter"></my-counter>`);

        const btn = screen.getByShadowText("Click me!");
        expect(screen.getByShadowText("0")).toBeVisible();

        expect(btn).toBeVisible();

        await click(btn);
        // The count increases when clicking.
        expect(screen.getByShadowText("1")).toBeVisible();
    });
});
