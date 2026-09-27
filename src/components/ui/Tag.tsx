import type { ReactNode } from "react";
import s from "./ui.module.css";

/** done = finished/neutral · chair = active/highlight · confirmed = expected · pending = waiting */
export type TagTone = "done" | "chair" | "confirmed" | "pending";

export function Tag({ tone, wide, children }: { tone: TagTone; wide?: boolean; children: ReactNode }) {
  return <span className={[s.tag, s[tone], wide ? s.tagWide : ""].join(" ")}>{children}</span>;
}
