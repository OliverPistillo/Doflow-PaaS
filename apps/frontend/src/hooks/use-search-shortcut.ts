import { useEffect, RefObject } from "react";

/**
 * Standardized '/' search keyboard shortcut hook.
 * Focuses the target input element when '/' is pressed,
 * unless an input, textarea, or contenteditable is already focused,
 * or a dialog/modal is currently open.
 */
export function useSearchShortcut(ref: RefObject<HTMLInputElement>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contenteditable element
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.hasAttribute("contenteditable");

      // Don't trigger if a modal/dialog is open to preserve focus trapping
      const isModal = document.querySelector('[role="dialog"]');

      // Check if '/' is pressed and no modifier keys (like Cmd or Ctrl) are active
      if (e.key === "/" && !isInput && !isModal && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ref]);
}
