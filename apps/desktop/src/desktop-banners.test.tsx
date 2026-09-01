// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClosePrompt } from "./components/ClosePrompt";

describe("ClosePrompt interactions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderPrompt(overrides: Partial<ComponentProps<typeof ClosePrompt>> = {}) {
    const callbacks = {
      onStayActive: vi.fn(),
      onExit: vi.fn(),
      onCancel: vi.fn(),
      ...overrides,
    };
    act(() => root.render(<ClosePrompt {...callbacks} />));
    return callbacks;
  }

  it("focuses the primary action and invokes it once with the remembered choice", () => {
    const callbacks = renderPrompt();
    const primary = container.querySelector<HTMLButtonElement>(".close-stay-action");
    const remember = container.querySelector<HTMLInputElement>(".remember-close-choice input");
    expect(document.activeElement).toBe(primary);

    act(() => remember?.click());
    act(() => {
      primary?.click();
      primary?.click();
    });

    expect(callbacks.onStayActive).toHaveBeenCalledOnce();
    expect(callbacks.onStayActive).toHaveBeenCalledWith(true);
    expect(callbacks.onExit).not.toHaveBeenCalled();
    expect(callbacks.onCancel).not.toHaveBeenCalled();
  });

  it("supports explicit exit without remembering the choice", () => {
    const callbacks = renderPrompt();
    act(() => container.querySelector<HTMLButtonElement>(".close-exit-action")?.click());
    expect(callbacks.onExit).toHaveBeenCalledOnce();
    expect(callbacks.onExit).toHaveBeenCalledWith(false);
  });

  it("maps Escape and the close button to cancellation", () => {
    const onCancelFromEscape = vi.fn();
    renderPrompt({ onCancel: onCancelFromEscape });
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(onCancelFromEscape).toHaveBeenCalledOnce();

    act(() => root.unmount());
    root = createRoot(container);
    const onCancelFromButton = vi.fn();
    renderPrompt({ onCancel: onCancelFromButton });
    act(() => container.querySelector<HTMLButtonElement>(".panel-close-button")?.click());
    expect(onCancelFromButton).toHaveBeenCalledOnce();
  });

  it("keeps keyboard focus inside the modal", () => {
    renderPrompt();
    const first = container.querySelector<HTMLButtonElement>(".panel-close-button");
    const last = container.querySelector<HTMLButtonElement>(".close-cancel-action");
    const focusable = [...container.querySelectorAll<HTMLElement>(
      '.close-prompt button:not(:disabled), .close-prompt input:not(:disabled), .close-prompt [href], .close-prompt [tabindex]:not([tabindex="-1"])',
    )];
    expect(focusable.at(-1)).toBe(last);
    first?.focus();
    expect(document.activeElement).toBe(first);
    act(() => first?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(last);

    last?.focus();
    expect(document.activeElement).toBe(last);
    act(() => last?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(first);
  });

  it("recovers from a failed action without exposing implementation details", async () => {
    const onStayActive = vi.fn().mockRejectedValue(new Error("sensitive internal detail"));
    renderPrompt({ onStayActive });
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".close-stay-action")?.click();
      await Promise.resolve();
    });
    expect(container.querySelector("[role=alert]")?.textContent).toBe("Operazione non riuscita. Riprova.");
    expect(container.textContent).not.toContain("sensitive internal detail");
    expect(container.querySelector<HTMLButtonElement>(".close-stay-action")?.disabled).toBe(false);
  });
});
