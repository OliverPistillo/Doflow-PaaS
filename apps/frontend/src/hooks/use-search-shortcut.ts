"use client";

import { useEffect, type RefObject } from "react";

/**
 * Hook to focus a search input when the "/" key is pressed.
 * Skips if an input is already focused, if a modal is open, or if modifier keys are held.
 */
export function useSearchShortcut(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || "");
      const isModal = document.querySelector('[role="dialog"]');

      if (e.key === "/" && !isInput && !isModal && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ref]);
}
