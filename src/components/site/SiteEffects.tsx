"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LoaderScreen } from "@/components/fx/FxProvider";
import { prefersReducedMotion } from "@/lib/fx/reduced-motion";

// Ported from the prototype's initFx(): intro loader, scroll reveal (with blur), parallax, cursor spotlight.

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const EASE = "cubic-bezier(0.22,1,0.36,1)";

export function SiteEffects({ intro = true }: { intro?: boolean }) {
  const [loader, setLoader] = useState<"show" | "hide" | "gone">("gone");
  // Decided once per mount (effects may run twice in development)
  const introDecision = useRef<number | null>(null);

  useIsoLayoutEffect(() => {
    // Intro loader once per browser session
    if (introDecision.current === null) {
      let seen = true;
      if (intro) {
        try {
          seen = sessionStorage.getItem("mj-intro") === "1";
          sessionStorage.setItem("mj-intro", "1");
        } catch {
          seen = false;
        }
      }
      introDecision.current = seen ? 0 : prefersReducedMotion() ? 400 : 2300;
    }
    const introMs = introDecision.current;
    const loaderTimers: ReturnType<typeof setTimeout>[] = [];
    if (introMs) {
      // Decided before first paint so content never flashes
      setLoader("show");
      loaderTimers.push(setTimeout(() => setLoader("hide"), introMs));
      loaderTimers.push(setTimeout(() => setLoader("gone"), introMs + 520));
    }
    if (prefersReducedMotion()) return () => loaderTimers.forEach(clearTimeout);
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    for (const el of els) {
      el.style.opacity = "0";
      el.style.transform = "translateY(26px)";
      if (el.hasAttribute("data-blur")) el.style.filter = "blur(12px)";
      el.style.transition = `opacity 0.9s ${EASE}, transform 0.9s ${EASE}, filter 0.9s ${EASE}`;
    }
    const pending = new Set(els);
    const show = (el: HTMLElement) => {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.filter = "none";
    };
    const pars = document.querySelectorAll<HTMLElement>("[data-parallax]");
    const timers: ReturnType<typeof setTimeout>[] = [];

    const onScroll = () => {
      const vh = window.innerHeight;
      let i = 0;
      for (const el of pending) {
        if (el.getBoundingClientRect().top < vh * 0.92) {
          timers.push(setTimeout(() => show(el), i++ * 110));
          pending.delete(el);
        }
      }
      for (const el of pars) {
        const r = el.parentElement!.getBoundingClientRect();
        const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
        el.style.transform = `translateY(${(p * -30).toFixed(1)}px) scale(1.14)`;
      }
    };

    // Start revealing as the intro loader fades
    const startDelay = introMs ? introMs + 100 : 0;
    const start = setTimeout(onScroll, startDelay);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // Parallax scale applies immediately so photos don't pop on first scroll
    for (const el of pars) el.style.transform = "scale(1.14)";
    // Fail-open: anything still hidden shows itself
    const failOpen = setTimeout(() => pending.forEach(show), startDelay + 2500);

    const spot = document.querySelector<HTMLElement>("[data-spotlight]");
    const host = spot?.parentElement;
    const onMove = (ev: MouseEvent) => {
      const r = host!.getBoundingClientRect();
      spot!.style.background = `radial-gradient(460px circle at ${ev.clientX - r.left}px ${ev.clientY - r.top}px, rgba(242,237,227,0.12), transparent 65%)`;
    };
    host?.addEventListener("mousemove", onMove);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      host?.removeEventListener("mousemove", onMove);
      clearTimeout(start);
      clearTimeout(failOpen);
      timers.forEach(clearTimeout);
      loaderTimers.forEach(clearTimeout);
    };
  }, [intro]);

  if (loader === "gone") return null;
  return <LoaderScreen label="Добро пожаловать" hiding={loader === "hide"} />;
}
