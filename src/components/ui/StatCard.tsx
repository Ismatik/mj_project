import { CountUp } from "@/components/fx/CountUp";
import s from "./ui.module.css";

export type Stat = { label: string; value: string; sub?: string; dark?: boolean };

export function StatCard({ label, value, sub, dark, index = 0, run }: Stat & { index?: number; run?: number }) {
  return (
    <div className={`${s.stat} ${dark ? s.statDark : ""}`} style={{ animationDelay: `${(index * 0.09).toFixed(2)}s` }}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>
        <CountUp value={value} run={run} />
      </div>
      {sub && <div className={s.statSub}>{sub}</div>}
    </div>
  );
}

export function StatGrid({ stats, run }: { stats: Stat[]; run?: number }) {
  return (
    <div className={s.statGrid}>
      {stats.map((st, i) => (
        <StatCard key={st.label} {...st} index={i} run={run} />
      ))}
    </div>
  );
}
