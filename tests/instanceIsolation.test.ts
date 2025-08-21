import { describe, expect, it, beforeEach } from "vitest";
import { click, render } from "./testingUtils";
import "@testing-library/jest-dom/vitest";
import "../examples/counter";
import type { Counter } from "../examples/counter";

/**
 * @jest-environment jsdom
 */
describe("State Isolation Between Component Instances", () => {
    beforeEach(() => {
        // Clean up DOM between tests
        document.body.innerHTML = "";
    });

    it("should not share state between different instances of the same component", async () => {
        await render(`
            <div id="counter1">
                <vui-counter heading="Counter 1"></vui-counter>
            </div>
            <div id="counter2">
                <vui-counter heading="Counter 2"></vui-counter>
            </div>
        `);

        const counter1: Counter | null = document.querySelector(
            "#counter1 vui-counter"
        );
        const counter2: Counter | null = document.querySelector(
            "#counter2 vui-counter"
        );

        if (counter1 === null || counter2 === null) {
            throw new Error("Counter elements not found");
        }

        expect(counter1.count).toBe(0);
        expect(counter2.count).toBe(0);

        counter1.count = 5;

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(counter1.count).toBe(5);
        expect(counter2.count).toBe(0);

        counter2.count = 3;

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(counter1.count).toBe(5);
        expect(counter2.count).toBe(3);
    });

    it("should not share state when clicking buttons on different instances", async () => {
        await render(`
            <div id="counter1">
                <vui-counter heading="Counter 1"></vui-counter>
            </div>
            <div id="counter2">
                <vui-counter heading="Counter 2"></vui-counter>
            </div>
        `);

        // Find buttons by their container
        const counter1Button = document
            .querySelector("#counter1 vui-counter")
            ?.shadowRoot?.querySelector("button");
        const counter2Button = document
            .querySelector("#counter2 vui-counter")
            ?.shadowRoot?.querySelector("button");

        if (!counter1Button || !counter2Button) {
            throw new Error("Counter button elements not found");
        }

        expect(counter1Button).toBeTruthy();
        expect(counter2Button).toBeTruthy();

        await click(counter1Button);
        await click(counter1Button);

        const counter1: Counter | null = document.querySelector(
            "#counter1 vui-counter"
        );
        const counter2: Counter | null = document.querySelector(
            "#counter2 vui-counter"
        );

        if (counter1 === null || counter2 === null) {
            throw new Error("Counter elements not found");
        }

        expect(counter1.count).toBe(2);
        expect(counter2.count).toBe(0);

        await click(counter2Button);

        expect(counter1.count).toBe(2);
        expect(counter2.count).toBe(1);
    });
});
