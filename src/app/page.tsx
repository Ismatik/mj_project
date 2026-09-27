import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";

// Temporary start page until the website lands in R1 Sprint 4.
export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <Monogram size={96} color="var(--mj-ink)" />
        <div style={{ fontSize: 11, letterSpacing: "0.26em", textTransform: "uppercase", color: "var(--mj-gold-deep)" }}>
          Сайт скоро откроется
        </div>
        <Link href="/login" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Вход для команды →
        </Link>
      </div>
    </main>
  );
}
