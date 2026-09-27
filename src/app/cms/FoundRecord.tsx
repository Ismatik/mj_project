import { Tag } from "@/components/ui/Tag";
import { db } from "@/lib/db";
import { clock, longDate, somoni } from "@/lib/format";
import { appointmentStatus, guestTag, paymentMethod } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import type { CurrentUser } from "@/server/auth";

const box: React.CSSProperties = {
  background: "var(--mj-paper)",
  border: "1px solid var(--mj-gold)",
  borderLeftWidth: 3,
  padding: "16px 20px",
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};
const kicker: React.CSSProperties = { fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: "var(--mj-gold-deep)" };
const title: React.CSSProperties = { fontFamily: "var(--mj-serif)", fontSize: 17, fontWeight: 600, marginTop: 6 };
const sub: React.CSSProperties = { fontSize: 12.5, fontWeight: 300, color: "var(--mj-text-2)", marginTop: 3 };

/** The record picked in header search, shown above the section until the full section views land. */
export async function FoundRecord({ kind, id, user }: { kind: "guest" | "appt" | "sale"; id?: string; user: CurrentUser }) {
  if (!id) return null;

  if (kind === "guest") {
    const g = await db.guest.findUnique({ where: { id }, include: { _count: { select: { appointments: true } } } });
    if (!g) return null;
    const t = guestTag[g.tag]!;
    return (
      <div style={box}>
        <div>
          <div style={kicker}>Гостья</div>
          <div style={title}>{g.name}</div>
          <div style={sub}>
            {formatPhone(g.phone)} · записей: {g._count.appointments}
          </div>
        </div>
        <Tag tone={t.tone}>{t.label}</Tag>
      </div>
    );
  }

  if (kind === "appt") {
    const a = await db.appointment.findUnique({ where: { id }, include: { staff: { include: { staff: true } } } });
    if (!a) return null;
    if (user.role === "MASTER" && !a.staff.some((x) => x.staffId === user.staffId)) return null;
    const st = appointmentStatus[a.status]!;
    return (
      <div style={box}>
        <div>
          <div style={kicker}>Запись</div>
          <div style={title}>
            {a.guestName} · {a.serviceLabel}
          </div>
          <div style={sub}>
            {longDate(a.startsAt)}, {clock(a.startsAt)} · мастер {a.staff.map((x) => x.staff.name).join(" + ")} · {somoni(a.price)}
          </div>
        </div>
        <Tag tone={st.tone} wide>
          {st.label}
        </Tag>
      </div>
    );
  }

  const s = await db.sale.findUnique({ where: { id }, include: { items: true, guest: true } });
  if (!s) return null;
  return (
    <div style={box}>
      <div>
        <div style={kicker}>Чек №{s.number}</div>
        <div style={title}>{somoni(s.total)}</div>
        <div style={sub}>
          {longDate(s.createdAt)}, {clock(s.createdAt)} · {paymentMethod[s.method]}
          {s.guest ? ` · ${s.guest.name}` : ""} · {s.items.map((i) => i.name).join(", ")}
        </div>
      </div>
    </div>
  );
}
