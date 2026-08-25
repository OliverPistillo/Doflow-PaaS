"use client"

import { createContext, useContext } from "react"

const DoflowExperienceContext = createContext(false)

export function DoflowExperienceProvider({ children }: { children: React.ReactNode }) {
  return <DoflowExperienceContext.Provider value>{children}</DoflowExperienceContext.Provider>
}

export function useIsDoflowExperience() {
  return useContext(DoflowExperienceContext)
}
