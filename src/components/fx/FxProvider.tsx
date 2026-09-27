"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/fx/reduced-motion";
import { NailLoader } from "./NailLoader";
import { PageSkeleton } from "./Skeleton";
import { sparkle } from "./sparkle";
import styles from "./fx.module.css";

type Toast = { id: number; message: string; kicker: string; leaving: boolean };
type LoaderState = { label: string; hiding: boolean } | null;
type SkeletonState = { rect: { left: number; top: number; width: number; height: number }; hiding: boolean } | null;

export type Fx = {
  /** Full-screen MJ loader for `ms`, then fades out. Resolves when content should appear. */
  runLoader: (ms: number, label?: string) => Promise<void>;
  showLoader: (label?: string) => void;
  hideLoader: () => void;
  toast: (message: string, kicker?: string) => void;
  /** Shimmer placeholder over an element (a CMS page area) for `ms`, then fades to the real content. */
  skeleton: (target: Element | null, ms?: number) => Promise<void>;
  sparkle: typeof sparkle;
};

const FxContext = createContext<Fx | null>(null);

export function useFx(): Fx {
  const fx = useContext(FxContext);
  if (!fx) throw new Error("useFx must be used inside <FxProvider>");
  return fx;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function FxProvider({ children }: { children: ReactNode }) {
  const [loader, setLoader] = useState<LoaderState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sk, setSk] = useState<SkeletonState>(null);
  const nextId = useRef(0);

  const showLoader = useCallback((label = "Минутку красоты…") => setLoader({ label, hiding: false }), []);
  const hideLoader = useCallback(() => {
    setLoader((l) => (l ? { ...l, hiding: true } : l));
    setTimeout(() => setLoader((l) => (l?.hiding ? null : l)), 520);
  }, []);
  const runLoader = useCallback(
    async (ms: number, label?: string) => {
      showLoader(label);
      await wait(prefersReducedMotion() ? Math.min(ms, 500) : ms);
      hideLoader();
    },
    [showLoader, hideLoader],
  );

  const toast = useCallback((message: string, kicker = "MJ") => {
    const id = nextId.current++;
    setToasts((ts) => [...ts, { id, message, kicker, leaving: false }]);
    setTimeout(() => setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t))), 3200);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 3600);
  }, []);

  const skeleton = useCallback(async (target: Element | null, ms = 520) => {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const top = Math.max(0, r.top);
    setSk({ rect: { left: r.left, top, width: r.width, height: window.innerHeight - top }, hiding: false });
    await wait(prefersReducedMotion() ? 150 : ms);
    setSk((s) => (s ? { ...s, hiding: true } : s));
    setTimeout(() => setSk((s) => (s?.hiding ? null : s)), 380);
  }, []);

  const fx = useMemo<Fx>(
    () => ({ runLoader, showLoader, hideLoader, toast, skeleton, sparkle }),
    [runLoader, showLoader, hideLoader, toast, skeleton],
  );

  return (
    <FxContext.Provider value={fx}>
      {children}

      {loader && (
        <div role="status" className={`${styles.loader} ${loader.hiding ? styles.loaderHiding : ""}`}>
          <NailLoader width={160} />
          <div className={styles.loaderLabel}>{loader.label}</div>
        </div>
      )}

      {sk && (
        <div aria-hidden="true" className={styles.skeletonOverlay} style={{ ...sk.rect, opacity: sk.hiding ? 0 : 1 }}>
          <PageSkeleton />
        </div>
      )}

      <div aria-live="polite" className={styles.toasts}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${t.leaving ? styles.toastLeaving : ""}`}>
            <span className={styles.toastKicker}>{t.kicker}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </FxContext.Provider>
  );
}
