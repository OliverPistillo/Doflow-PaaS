"use client";

import { useEffect, useState } from "react";

export function useCurrentDate(refreshMilliseconds = 60_000) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), refreshMilliseconds);
    return () => window.clearInterval(timer);
  }, [refreshMilliseconds]);

  return currentDate;
}
