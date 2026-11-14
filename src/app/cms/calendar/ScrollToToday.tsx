"use client";

import { useEffect } from "react";

/**
 * On a phone the week is one long column that starts on Monday, so by Saturday today is five
 * screens down. Masters open this between clients to see what is next; bring today to the top.
 * Only when the days are stacked: on a desktop the whole week is already in view.
 */
export function ScrollToToday({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 600px)").matches) return;
    document.getElementById(targetId)?.scrollIntoView({ block: "start" });
  }, [targetId]);
  return null;
}
