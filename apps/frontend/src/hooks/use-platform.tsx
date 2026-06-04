import * as React from "react"

/**
 * Hook to detect the user's platform and provide appropriate keyboard shortcut labels.
 */
export function usePlatform() {
  const [isMac, setIsMac] = React.useState(false)

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(navigator.userAgent.toUpperCase().indexOf("MAC") >= 0)
    }
  }, [])

  const modifierKey = isMac ? "⌘" : "Ctrl"
  const modifierLabel = isMac ? "Command" : "Control"

  return {
    isMac,
    modifierKey,
    modifierLabel,
  }
}
