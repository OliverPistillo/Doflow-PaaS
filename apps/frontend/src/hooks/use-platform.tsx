"use client";

import * as React from "react";

export function usePlatform() {
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const platform = window.navigator.platform.toUpperCase();
      const userAgent = window.navigator.userAgent.toUpperCase();
      setIsMac(platform.includes("MAC") || userAgent.includes("MAC"));
    }
  }, []);

  return {
    isMac,
    modifierKey: isMac ? "⌘" : "Ctrl",
    modifierLabel: isMac ? "Command" : "Control",
  };
}
