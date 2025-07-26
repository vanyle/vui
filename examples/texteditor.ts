import { customElement, html, state, VUI } from "../src/vui";

@customElement("text-editor")
export class TextEditor extends VUI.Component {
    @state()
    accessor content: string = "";

    render() {
        return html`<div>
            <textarea
                @input=${(e: InputEvent) => {
                    const target = e.target as HTMLTextAreaElement;
                    this.content = target.value;
                }}
            >
                ${this.content}
            </textarea
            >
            <div class="preview">${this.content}</div>
        </div>`;
    }
}
