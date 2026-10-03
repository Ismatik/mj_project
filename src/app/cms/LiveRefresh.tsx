"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Pulls this page's server data again every few seconds, so a booking made in Telegram or by the
 * other receptionist shows up without anyone pressing F5.
 *
 * Only on the pages the salon actually keeps open and watches - the calendar, the dashboard, the
 * waitlist. Reports and settings are read after the fact and do not need it.
 *
 * Nothing happens while the tab is in the background: the salon leaves this open all day on one
 * laptop, and a hidden tab polling the database earns nobody anything. Coming back to the tab
 * refreshes at once rather than waiting out the rest of the interval.
 */
export function LiveRefresh({ seconds = 45 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
