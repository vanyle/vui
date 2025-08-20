import { describe, expect, it, beforeEach } from "vitest";
import { click, render } from "./testingUtils";
import "@testing-library/jest-dom/vitest";
import "../examples/counter";

/**
 * @jest-environment jsdom
 */
describe("State Isolation Between Component Instances", () => {
    beforeEach(() => {
        // Clean up DOM between tests
        document.body.innerHTML = '';
    });

    it("should not share state between different instances of the same component", async () => {
        // Create two counter instances
        await render(`
            <div id="counter1">
                <vui-counter heading="Counter 1"></vui-counter>
            </div>
            <div id="counter2">
                <vui-counter heading="Counter 2"></vui-counter>
            </div>
        `);

        // Get both counter instances
        const counter1 = document.querySelector('#counter1 vui-counter') as any;
        const counter2 = document.querySelector('#counter2 vui-counter') as any;

        // Both should start at 0
        expect(counter1.count).toBe(0);
        expect(counter2.count).toBe(0);

        // Increment first counter
        counter1.count = 5;
        
        // Wait for any rendering
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Second counter should still be 0, not affected by first counter
        expect(counter1.count).toBe(5);
        expect(counter2.count).toBe(0); // This will fail with the current implementation

        // Increment second counter
        counter2.count = 3;
        
        // Wait for any rendering
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Both should maintain their separate values
        expect(counter1.count).toBe(5);
        expect(counter2.count).toBe(3);
    });

    it("should not share state when clicking buttons on different instances", async () => {
        // Create two counter instances
        await render(`
            <div id="counter1">
                <vui-counter heading="Counter 1"></vui-counter>
            </div>
            <div id="counter2">
                <vui-counter heading="Counter 2"></vui-counter>
            </div>
        `);

        // Find buttons by their container
        const counter1Button = document.querySelector('#counter1 vui-counter')?.shadowRoot?.querySelector('button');
        const counter2Button = document.querySelector('#counter2 vui-counter')?.shadowRoot?.querySelector('button');

        expect(counter1Button).toBeTruthy();
        expect(counter2Button).toBeTruthy();

        // Click first counter button twice
        await click(counter1Button as HTMLElement);
        await click(counter1Button as HTMLElement);

        // Check that only first counter changed
        const counter1 = document.querySelector('#counter1 vui-counter') as any;
        const counter2 = document.querySelector('#counter2 vui-counter') as any;

        expect(counter1.count).toBe(2);
        expect(counter2.count).toBe(0); // This will fail with the current implementation

        // Click second counter button once
        await click(counter2Button as HTMLElement);

        // Check final states
        expect(counter1.count).toBe(2);
        expect(counter2.count).toBe(1);
    });
});