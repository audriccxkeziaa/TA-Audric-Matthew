"use client";
// Debounce sederhana untuk pencarian — tunda update value selama `delay` ms.

import { useEffect, useState } from "react";

export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
