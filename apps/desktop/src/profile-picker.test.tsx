// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePicker } from "./components/ProfilePicker";
import { ExpiredProfileScreen } from "./components/StatusScreens";
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

  it("selects, adds and removes the exact supplied profiles", async () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    const onAdd = vi.fn();
    act(() => root.render(<ProfilePicker profiles={profiles} selectedProfileId={profiles[0].id} onSelect={onSelect} onRemove={onRemove} onAdd={onAdd} onClose={() => undefined} />));

    const selectButtons = [...container.querySelectorAll<HTMLButtonElement>(".profile-main")];
    expect(selectButtons).toHaveLength(3);
    await act(async () => {
      selectButtons[1].click();
      await Promise.resolve();
    });
    expect(onSelect).toHaveBeenCalledWith(profiles[1]);

    const add = container.querySelector<HTMLButtonElement>(".profile-add-action");
    await act(async () => {
      add?.click();
      await Promise.resolve();
    });
    expect(onAdd).toHaveBeenCalledOnce();

    expect(container.querySelector(".profile-more")).toBeNull();
    const manage = container.querySelector<HTMLButtonElement>(".profile-management-toggle");
    act(() => manage?.click());
    const remove = container.querySelector<HTMLButtonElement>(".profile-remove-action");
    act(() => remove?.click());
    expect(container.querySelector("[role=dialog]")?.textContent).toContain("L’account Doflow non verrà eliminato");
    const confirm = container.querySelector<HTMLButtonElement>(".danger-action");
    act(() => confirm?.click());
    expect(onRemove).toHaveBeenCalledWith(profiles[0]);
  });

  it("uses native focusable controls and disables every action while busy", () => {
    act(() => root.render(<ProfilePicker profiles={profiles} busyProfileId={profiles[1].id} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} />));
    const blockedActions = [...container.querySelectorAll<HTMLButtonElement>(".profile-main, .profile-add-action, .profile-management-toggle")];
    expect(blockedActions).toHaveLength(5);
    expect(blockedActions.every((button) => button.disabled)).toBe(true);
    expect(container.querySelectorAll(".profile-row.is-selected")).toHaveLength(1);
    expect(container.querySelector(".profile-row[aria-busy=true]")).not.toBeNull();
    expect(container.textContent).toContain(profiles[2].email);
    expect(container.querySelectorAll<HTMLButtonElement>(".profile-main")[2].getAttribute("aria-label")).toContain("tenant workspace");
    expect(container.querySelector<HTMLButtonElement>(".panel-close-button")?.disabled).toBe(false);

    act(() => root.render(<ProfilePicker profiles={profiles} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} />));
    const first = container.querySelector<HTMLButtonElement>(".profile-main");
    first?.focus();
    expect(document.activeElement).toBe(first);
    expect(first?.getAttribute("aria-label")).toContain(profiles[0].email);
  });

  it("uses Escape to leave management before closing the profile surface", () => {
    const onClose = vi.fn();
    act(() => root.render(<ProfilePicker profiles={profiles} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={onClose} />));
    const manage = container.querySelector<HTMLButtonElement>(".profile-management-toggle");
    act(() => manage?.click());
    expect(manage?.getAttribute("aria-pressed")).toBe("true");

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLButtonElement>(".profile-management-toggle")?.getAttribute("aria-pressed")).toBe("false");

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("forgets a saved password without removing the profile", async () => {
    const onForgetPassword = vi.fn();
    const onRemove = vi.fn();
    act(() => root.render(
      <ProfilePicker
        profiles={profiles}
        credentialProfileIds={new Set([profiles[0].id])}
        onSelect={() => undefined}
        onRemove={onRemove}
        onForgetPassword={onForgetPassword}
        onAdd={() => undefined}
        onClose={() => undefined}
      />,
    ));

    act(() => container.querySelector<HTMLButtonElement>(".profile-management-toggle")?.click());
    expect(container.textContent).toContain("Dimentica password");
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".profile-forget-action")?.click();
      await Promise.resolve();
    });
    expect(onForgetPassword).toHaveBeenCalledOnce();
    expect(onForgetPassword).toHaveBeenCalledWith(profiles[0]);
    expect(onRemove).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".profile-row")).toHaveLength(3);
  });

  it("closes from the integrated X and safely removes the last supplied profile", async () => {
    const onClose = vi.fn();
    act(() => root.render(<ProfilePicker profiles={[]} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={onClose} />));
    expect(container.textContent).toContain("Nessun profilo memorizzato");
    expect(container.textContent).not.toContain("Oliver");
    act(() => container.querySelector<HTMLButtonElement>(".panel-close-button")?.click());
    expect(onClose).toHaveBeenCalledOnce();

    const onRemove = vi.fn();
    act(() => root.render(<ProfilePicker profiles={[profiles[0]]} onSelect={() => undefined} onRemove={onRemove} onAdd={() => undefined} onClose={() => undefined} />));
    expect(container.querySelectorAll(".profile-row")).toHaveLength(1);
    act(() => container.querySelector<HTMLButtonElement>(".profile-management-toggle")?.click());
    act(() => container.querySelector<HTMLButtonElement>(".profile-remove-action")?.click());
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".danger-action")?.click();
      await Promise.resolve();
    });
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith(profiles[0]);
  });

  it("blocks duplicate profile actions and recovers from an asynchronous preparation error", async () => {
    let rejectPreparation: ((error: Error) => void) | undefined;
    const onSelect = vi.fn(() => new Promise<void>((_resolve, reject) => {
      rejectPreparation = reject;
    }));
    act(() => root.render(<ProfilePicker profiles={profiles} onSelect={onSelect} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} />));
    const select = container.querySelector<HTMLButtonElement>(".profile-main");
    act(() => {
      select?.click();
      select?.click();
    });
    expect(onSelect).toHaveBeenCalledOnce();
    expect([...container.querySelectorAll<HTMLButtonElement>(".profile-main")].every((button) => button.disabled)).toBe(true);

    await act(async () => {
      rejectPreparation?.(new Error("private runtime detail"));
      await Promise.resolve();
    });
    expect(container.querySelector("[role=alert]")?.textContent).toBe("Operazione non riuscita. Riprova.");
    expect(container.textContent).not.toContain("private runtime detail");
    expect(container.querySelector<HTMLButtonElement>(".profile-main")?.disabled).toBe(false);
  });

  it("keeps long and ambiguous profile data isolated in accessible labels", () => {
    const duplicate = {
      ...profiles[1],
      id: "90000000-4000-4000-8000-000000000009",
      tenantSlug: "tenant-con-un-identificatore-molto-lungo",
      name: profiles[0].name,
      email: "indirizzo.profilo.molto.lungo@example.test",
    };
    act(() => root.render(<ProfilePicker profiles={[profiles[0], duplicate]} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} />));
    const rows = container.querySelectorAll<HTMLButtonElement>(".profile-main");
    expect(rows).toHaveLength(2);
    expect(rows[1].getAttribute("aria-label")).toContain("tenant tenant-con-un-identificatore-molto-lungo");
    expect(container.textContent).toContain("tenant-con-un-identificatore-molto-lungo");
  });

  it("routes the expired profile to reauthentication and other profiles to preparation", async () => {
    const onReauthenticate = vi.fn();
    const onSelect = vi.fn();
    act(() => root.render(
      <ExpiredProfileScreen
        profile={profiles[0]}
        profiles={profiles}
        onReauthenticate={onReauthenticate}
        onSelect={onSelect}
        onRemove={() => undefined}
        onAdd={() => undefined}
        onClose={() => undefined}
      />,
    ));
    const rows = container.querySelectorAll<HTMLButtonElement>(".profile-main");
    act(() => rows[0].click());
    expect(onReauthenticate).toHaveBeenCalledOnce();
    await act(async () => Promise.resolve());
    act(() => rows[1].click());
    expect(onSelect).toHaveBeenCalledWith(profiles[1]);
  });
});
