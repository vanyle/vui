import { css, customElement, html, state, VUI } from "../src/vui";

@customElement("toggle-example")
export class Toggle extends VUI.Component {
    @state()
    accessor options: string[] = ["Option 1", "Option 2"];

    @state()
    accessor selected: string = "Option 1";

    render() {
        return html`<div>
            ${this.options.map(
                (option) =>
                    html`<div
                        class="option ${option === this.selected && "selected"}"
                        @click=${() => {
                            this.selected = option;
                        }}
                    >
                        ${option}
                    </div>`,
            )}
        </div>`;
    }

    static override styles = css`
        div {
            display: inline-flex;
        }
        .option {
            padding: 8px;
            background-color: lightblue;
            cursor: pointer;
        }
        .option.selected {
            background-color: darkblue;
            color: white;
        }
    `;
}
