export async function render(html: string) {
    const div = document.createElement("div");
    div.innerHTML = html;
    document.body.appendChild(div);
    // Wait a tick for component to render
    // We need to do this as components use queueMicrotask to render
    await new Promise((resolve) => setTimeout(resolve, 0));
}

export async function click(button: HTMLElement) {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
}
