import { html, VUI, type UnevaluatedFragment } from "../src/vui.mts";

export class MyCounter extends VUI.Component {
  @VUI.attribute("count")
  accessor count = 0;

  override render(): UnevaluatedFragment {
    return html`<button @click=${() => this.count++}>
      Counter: ${this.count}
    </button>`;
  }
}
VUI.register("my-counter")(MyCounter);
