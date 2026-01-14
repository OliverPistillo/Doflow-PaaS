import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Stato iniziale stabile (SSR-safe)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    const update = () => setIsMobile(mql.matches)
    update()

    // Compatibilità moderna + legacy senza warning TS
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update)
      return () => mql.removeEventListener("change", update)
    } else {
      mql.addListener(update)
      return () => mql.removeListener(update)
    }
  }, [])

  return isMobile
}
