import type { CSSProperties } from "react";
import styles from "./fx.module.css";

/** A single shimmering block. */
export function Sk({ w = "100%", h, round, style }: { w?: string | number; h: number; round?: boolean; style?: CSSProperties }) {
  return <div className={styles.sk} style={{ width: w, height: h, borderRadius: round ? "50%" : undefined, ...style }} />;
}

/** Page placeholder shown while a CMS section loads: kicker, title, stat cards and a list. */
export function PageSkeleton() {
  return (
    <>
      <Sk w="14%" h={10} />
      <Sk w="42%" h={30} />
      <div className={styles.skeletonCards}>
        {Array.from({ length: 4 }, (_, i) => (
          <Sk key={i} h={96} />
        ))}
      </div>
      <div className={styles.skeletonList}>
        {Array.from({ length: 5 }, (_, j) => (
          <div key={j} className={styles.skeletonRow}>
            <Sk w={36} h={36} round />
            <div className={styles.skeletonLines}>
              <Sk w={`${50 + j * 7}%`} h={11} />
              <Sk w="28%" h={9} />
            </div>
            <Sk w={80} h={22} />
          </div>
        ))}
      </div>
    </>
  );
}
