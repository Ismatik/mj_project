import type { ReactNode } from "react";
import s from "./ui.module.css";

/** Horizontal share bar ("Что любят гостьи", "Пиковые часы"). */
export function ShareBar({
  name,
  icon,
  share,
  width,
  color = "var(--mj-gold)",
  delay = 0,
}: {
  name: ReactNode;
  icon?: ReactNode;
  share: string;
  width: string;
  color?: string;
  delay?: number;
}) {
  return (
    <div>
      <div className={s.barLabel}>
        <span className={s.barName}>
          {icon}
          {name}
        </span>
        <span className={s.barShare}>{share}</span>
      </div>
      <div className={s.track}>
        <div className={s.fill} style={{ width, background: color, animationDelay: `${delay}s` }} />
      </div>
    </div>
  );
}

export type DayBar = { label: string; amount: number; title: string };

/** Dark revenue panel with vertical bars; the last bar is gold. */
export function RevenueChart({
  label,
  bars,
  height = 88,
  footLeft,
  footRight,
  total,
}: {
  label: string;
  bars: DayBar[];
  height?: number;
  footLeft?: string;
  footRight?: string;
  total?: ReactNode;
}) {
  const max = Math.max(1, ...bars.map((b) => b.amount));
  return (
    <div className={s.chart}>
      <div className={s.chartLabel}>{label}</div>
      <div className={s.chartBars} style={{ height }} role="img" aria-label={bars.map((b) => `${b.label}: ${b.title}`).join(", ")}>
        {bars.map((b, i) => (
          <div
            key={b.label}
            className={s.chartBar}
            title={`${b.label} · ${b.title}`}
            style={{
              height: `${Math.round((b.amount / max) * 100)}%`,
              background: i === bars.length - 1 ? "var(--mj-gold)" : "var(--mj-ink-bar)",
              animationDelay: `${(0.3 + i * 0.05).toFixed(2)}s`,
            }}
          />
        ))}
      </div>
      {(footLeft || total || footRight) && (
        <div className={s.chartFoot}>
          <span>{footLeft}</span>
          <span className={s.chartTotal}>{total}</span>
          <span>{footRight}</span>
        </div>
      )}
    </div>
  );
}
