// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePicker } from "./components/ProfilePicker";
import type { SavedProfile } from "./types";

const profiles: SavedProfile[] = [1, 2, 3].map((index) => ({
  id: `${index}0000000-4000-4000-8000-00000000000${index}`,
  userId: `qa-${index}`,
  tenantSlug: index === 3 ? "workspace" : "doflow",
  name: `Profilo ${index}`,
  email: `profilo${index}@example.test`,
  initials: `P${index}`,
  createdAt: "2026-01-01T00:00:00Z",
  lastUsedAt: "2026-01-01T00:00:00Z",
  webviewContextId: `${index}0000000-4000-4000-8000-00000000000${index}`,
}));

describe("ProfilePicker interactions", () => {
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

  it("selects, adds and removes the exact supplied profiles", () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    const onAdd = vi.fn();
    act(() => root.render(<ProfilePicker profiles={profiles} onSelect={onSelect} onRemove={onRemove} onAdd={onAdd} />));

    const selectButtons = [...container.querySelectorAll<HTMLButtonElement>(".profile-main")];
    expect(selectButtons).toHaveLength(3);
    act(() => selectButtons[1].click());
    expect(onSelect).toHaveBeenCalledWith(profiles[1]);

    const add = container.querySelector<HTMLButtonElement>(".profile-picker-panel > .secondary-action");
    act(() => add?.click());
    expect(onAdd).toHaveBeenCalledOnce();

    const more = container.querySelector<HTMLButtonElement>(".profile-more");
    act(() => more?.click());
    const remove = container.querySelector<HTMLButtonElement>("[role=menuitem]");
    act(() => remove?.click());
    expect(onRemove).toHaveBeenCalledWith(profiles[0]);
  });

  it("uses native focusable controls and disables every action while busy", () => {
    act(() => root.render(<ProfilePicker profiles={profiles} busyProfileId={profiles[1].id} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} />));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.length).toBeGreaterThanOrEqual(7);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(container.textContent).toContain(profiles[2].email);
    expect(container.textContent).toContain("workspace");

    act(() => root.render(<ProfilePicker profiles={profiles} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} />));
    const first = container.querySelector<HTMLButtonElement>(".profile-main");
    first?.focus();
    expect(document.activeElement).toBe(first);
    const contextual = container.querySelector<HTMLButtonElement>(".profile-more");
    expect(contextual?.getAttribute("aria-label")).toBe(`Azioni per ${profiles[0].name}`);
  });
});
