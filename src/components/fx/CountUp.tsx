"use client";

import { useEffect, useState } from "react";
import { easeOutCubic, formatCountUp, parseCountUp } from "@/lib/fx/countup";
import { useReducedMotion } from "@/lib/fx/reduced-motion";

/** Animates the number inside a label ("12 833 c.", "68%") from zero on mount or when `run` changes. */
export function CountUp({ value, duration = 1100, run = 0 }: { value: string; duration?: number; run?: number }) {
  const reduced = useReducedMotion();
  // Text of the running animation; null when resting on the final value.
  const [frameText, setFrameText] = useState<string | null>(null);

  useEffect(() => {
    const parts = parseCountUp(value);
    if (!parts || reduced) return;
    let frame = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setFrameText(p < 1 ? formatCountUp(parts, parts.value * easeOutCubic(p)) : null);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setFrameText(null);
    };
  }, [value, duration, reduced, run]);

  return <>{frameText ?? value}</>;
}
