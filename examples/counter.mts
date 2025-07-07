import { css, html, VUI } from "../src/vui.mts";

class Counter extends VUI.Component {
  @VUI.attribute("count")
  accessor count: number = 0;

  @VUI.attribute("heading")
  accessor heading: string = "Counter";

  render() {
    return html`
      <h1>${this.heading}</h1>
      <div>Counter: ${this.count}</div>
      <button @click=${() => this.onClick()}>Click me!</button>
    `;
  }
  onClick() {
    this.count += 1;
  }

  static style = css`
    h1 {
      color: blue;
    }
    button {
      background-color: lightblue;
      border: none;
      padding: 10px;
      cursor: pointer;
    }
  `;
}
VUI.register("my-counter")(Counter);
