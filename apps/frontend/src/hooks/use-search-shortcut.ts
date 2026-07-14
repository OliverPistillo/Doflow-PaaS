"use client";

import { useEffect, type RefObject } from "react";

/**
 * Hook to focus a search input when the '/' key is pressed.
 * Prevents activation if an input, textarea, or dialog is already focused/open.
 */
export function useSearchShortcut(inputRef: RefObject<HTMLInputElement>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if meta or ctrl keys are held
      if (e.ctrlKey || e.metaKey) return;

      // Don't trigger if already in an input or textarea
      const isInput = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || "");

      // Don't trigger if a dialog/modal is open
      const isModal = document.querySelector('[role="dialog"]');

      if (e.key === "/" && !isInput && !isModal) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputRef]);
}
