"use client";

import * as React from "react";

const subscribeToPlatform = () => () => undefined;
const readIsMac = () => {
  const platform = window.navigator.platform.toUpperCase();
  const userAgent = window.navigator.userAgent.toUpperCase();
  return platform.includes("MAC") || userAgent.includes("MAC");
};

export function usePlatform() {
  const isMac = React.useSyncExternalStore(subscribeToPlatform, readIsMac, () => false);

  return {
    isMac,
    modifierKey: isMac ? "⌘" : "Ctrl",
    modifierLabel: isMac ? "Command" : "Control",
  };
}
