import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { ROLE_LABEL } from "@/lib/access";
import { requireSiteAdmin } from "@/server/auth";
import { logout } from "../login/actions";

export const metadata: Metadata = { title: "Админка сайта · Mavzunai Jovid", robots: { index: false } };

// Placeholder until the site admin lands in R1 Sprint 4.
export default async function AdminPage() {
  const user = await requireSiteAdmin();
  return (
    <main style={{ minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 32px", background: "var(--mj-ink)", color: "var(--mj-cream)", flexWrap: "wrap" }}>
        <Monogram size={30} />
        <div style={{ fontFamily: "var(--mj-serif)", fontSize: 15, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>Админка сайта</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--mj-text-muted)" }}>
          {user.name} — {ROLE_LABEL[user.role]}
        </span>
        {user.role === "OWNER" && (
          <Link href="/cms" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--mj-gold)" }}>
            CMS салона →
          </Link>
        )}
        <form action={logout}>
          <button type="submit" style={{ background: "none", border: "none", color: "var(--mj-text-muted)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}>
            Выйти
          </button>
        </form>
      </header>
      <div style={{ padding: 32, maxWidth: 760 }}>
        <h1 style={{ fontFamily: "var(--mj-serif)", fontSize: 24, fontWeight: 600, letterSpacing: "0.06em" }}>Тексты, цены, фото, отзывы, SEO</h1>
        <p style={{ fontSize: 13, fontWeight: 300, color: "var(--mj-text-2)" }}>Разделы админки сайта появятся в Sprint 4. Вход и права доступа уже работают.</p>
      </div>
    </main>
  );
}
