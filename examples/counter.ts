import { attribute, css, customElement, html, state, VUI } from "../src/vui";

@customElement("my-counter")
export class Counter extends VUI.Component {
    @state()
    accessor count: number = 0;

    @attribute({ name: "heading" })
    accessor heading: string = "Counter";

    render() {
        return html`
            <div>${this.heading}<span>${this.count}</span></div>
            <button @click=${() => this.onClick()}>Click me!</button>
        `;
    }
    onClick() {
        this.count += 1;
    }

    static override styles = css`
        :host {
            display: inline-flex;
        }
        :host > * {
            padding: 8px;
        }
        div {
            background-color: lightblue;
        }
        button {
            background-color: lightgreen;
            border: none;
            cursor: pointer;
        }
    `;
}
