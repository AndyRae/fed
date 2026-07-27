/**
 * Minimal vanilla-DOM builder, in the spirit of PGSimCity's src/ui/uikit.ts
 * — three.js is the only runtime dependency this project allows, so the
 * HUD is built with plain DOM rather than a UI framework. Not unit tested:
 * it only ever touches a real `document`, so it's verified in the browser
 * like the rest of `src/engine` — see CLAUDE.md "Verify the deliverable".
 */
type Attrs = Record<string, unknown> & {
  class?: string;
  text?: string;
  on?: Record<string, EventListenerOrEventListenerObject>;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else if (key === "on") {
      for (const [event, handler] of Object.entries(value as Record<string, EventListener>)) {
        node.addEventListener(event, handler);
      }
    } else if (key in node) {
      (node as unknown as Record<string, unknown>)[key] = value;
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Sets textContent only if it actually changed — avoids needless layout work. */
export function setText(node: { textContent: string | null }, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

/** Toggles a class only if its state actually changed. */
export function setClass(node: Element, className: string, on: boolean): void {
  if (node.classList.contains(className) !== on) node.classList.toggle(className, on);
}
