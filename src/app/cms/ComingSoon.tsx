import type { ReactNode } from "react";
import { PageHead } from "@/components/ui/Headings";

/** Placeholder body for sections built in R1 Sprint 3. */
export function ComingSoon({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHead title={title} meta={meta} />
      <div
        style={{
          border: "1px dashed var(--mj-line)",
          background: "var(--mj-paper)",
          padding: "40px 24px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ color: "var(--mj-gold)", fontSize: 18 }}>✦</span>
        <div style={{ fontFamily: "var(--mj-serif)", fontSize: 15, fontWeight: 600, letterSpacing: "0.08em" }}>
          Раздел в работе
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 300, color: "var(--mj-text-2)", maxWidth: "44ch" }}>
          {children ?? "Этот раздел появится в следующем спринте. Меню, поиск и новая запись уже работают."}
        </div>
      </div>
    </div>
  );
}
