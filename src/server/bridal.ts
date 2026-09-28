import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { dressSpan, normalizeBridalRules, overlaps, packagePrice, type BridalRules } from "@/lib/bridal";
import { db } from "@/lib/db";
import { clock, longDate, somoni } from "@/lib/format";
import { bridalDict } from "@/lib/i18n/dict-bridal";
import { localePath, type Lang } from "@/lib/i18n/locales";
import { formatPhone } from "@/lib/phone";
import { addDays, atSalonTime, todayYmd, type Ymd } from "@/lib/time";
import { createGuestBooking, getOnlineMenu } from "./online-booking";

// Bridal packages: services for the wedding day with a package discount, a dress from the rental catalog
// and a trial look before the wedding. Reception confirms and books the wedding-day times.

export const BRIDAL_SETTING = "bridalRules";
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const dateOf = (y: Ymd) => new Date(`${y}T00:00:00Z`);

export async function getBridalRules(): Promise<BridalRules> {
  const row = await db.setting.findUnique({ where: { key: BRIDAL_SETTING } });
  const rules = normalizeBridalRules(row?.value);
  if (!rules.trialServiceId) {
    const trial = await db.service.findFirst({ where: { active: true, name: { contains: "Пробный", mode: "insensitive" } } });
    rules.trialServiceId = trial?.id ?? null;
  }
  return rules;
}

/** Everything the builder needs, in the guest's language */
export async function getBridalOptions(lang: Lang) {
  const [rules, menu, dresses] = await Promise.all([getBridalRules(), getOnlineMenu(lang), db.dress.findMany({ where: { status: "AVAILABLE" }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }] })]);
  const trial = rules.trialServiceId ? await db.service.findFirst({ where: { id: rules.trialServiceId, active: true } }) : null;
  return {
    rules: { discountPercent: rules.discountPercent, minServices: rules.minServices, dressDays: rules.dressDays },
    groups: menu.map((c) => ({ id: c.id, name: c.name, services: c.services.filter((s) => s.id !== trial?.id).map((s) => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin })) })).filter((g) => g.services.length),
    dresses: dresses.map((d) => ({ id: d.id, name: d.name, type: d.type, size: d.size, pricePerDay: d.pricePerDay, photoUrl: d.photoUrl })),
    trial: trial ? { id: trial.id, price: trial.price, depositPercent: trial.depositPercent, durationMin: trial.durationMin } : null,
  };
}
export type BridalOptions = Awaited<ReturnType<typeof getBridalOptions>>;

/** Dresses already taken around this wedding day */
export async function takenDresses(wedding: Ymd): Promise<string[]> {
  const rules = await getBridalRules();
  const span = dressSpan(wedding, rules.dressDays);
  const bookings = await db.dressBooking.findMany({ where: { startsOn: { lte: dateOf(span.to) }, endsOn: { gte: dateOf(span.from) } } });
  return [...new Set(bookings.filter((b) => overlaps({ startsOn: ymd(b.startsOn), endsOn: ymd(b.endsOn) }, span)).map((b) => b.dressId))];
}

export type BridalInput = {
  weddingDate: string;
  serviceIds: string[];
  dressId: string | null;
  trial: { date: string; time: string } | null;
  name: string;
  phone: string; // normalized
  note: string;
};
export type BridalResult =
  | { ok: true; number: number; total: number; trial?: { ok: true; when: string; payment?: { amount: number; url: string; payBy: string } } | { ok: false; error: string } }
  | { ok: false; field?: "date" | "services" | "dress" | "name" | "phone"; error: string };

export async function submitBridal(input: BridalInput, lang: Lang, guestId?: string | null): Promise<BridalResult> {
  const t = bridalDict(lang);
  const today = todayYmd();
  const wedding = input.weddingDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wedding) || wedding <= today || wedding > addDays(today, 400)) return { ok: false, field: "date", error: t.errors.date };
  const rules = await getBridalRules();
  const ids = [...new Set(input.serviceIds.map(String))].slice(0, 12);
  const services = await db.service.findMany({ where: { id: { in: ids }, active: true, showOnSite: true } });
  if (!services.length || services.length !== ids.length) return { ok: false, field: "services", error: t.errors.services };
  const span = dressSpan(wedding, rules.dressDays);

  const created = await db.$transaction(async (tx) => {
    let dress = null;
    if (input.dressId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"dress:" + input.dressId}))::text AS locked`;
      dress = await tx.dress.findFirst({ where: { id: input.dressId, status: "AVAILABLE" } });
      if (!dress) return { error: "dress" as const };
      const clash = await tx.dressBooking.findFirst({ where: { dressId: dress.id, startsOn: { lte: dateOf(span.to) }, endsOn: { gte: dateOf(span.from) } } });
      if (clash) return { error: "dress" as const };
    }
    const price = packagePrice(services, dress, rules);
    const guest =
      (guestId ? await tx.guest.findUnique({ where: { id: guestId } }) : null) ??
      (await tx.guest.findUnique({ where: { phone: input.phone } })) ??
      (await tx.guest.create({ data: { name: input.name, phone: input.phone, tag: "BRIDE", lang } }));
    if (guest.tag === "NEW" || guest.tag === "REGULAR") await tx.guest.update({ where: { id: guest.id }, data: { tag: "BRIDE" } });
    const pkg = await tx.bridalPackage.create({
      data: {
        guestId: guest.id,
        name: input.name,
        phone: input.phone,
        lang,
        weddingDate: dateOf(wedding),
        services: services.map((s) => ({ serviceId: s.id, name: s.name, price: s.price })) as Prisma.InputJsonValue,
        dressId: dress?.id ?? null,
        dressDays: dress ? rules.dressDays : 0,
        dressPrice: price.dressSum,
        subtotal: price.subtotal,
        discountPercent: price.discountPercent,
        total: price.total,
        note: input.note.trim().slice(0, 500) || null,
        source: "WEBSITE",
      },
    });
    if (dress) await tx.dressBooking.create({ data: { dressId: dress.id, guestId: guest.id, startsOn: dateOf(span.from), endsOn: dateOf(span.to), bridalPackageId: pkg.id } });
    await tx.outboxMessage.create({
      data: {
        channel: "telegram",
        to: "reception",
        body: `Свадебный пакет №${pkg.number} с сайта: ${input.name}, ${formatPhone(input.phone)} — свадьба ${longDate(atSalonTime(wedding, "12:00"))}. Услуги: ${services.map((s) => s.name).join(", ")}${dress ? `; платье «${dress.name.replace(/^Платье\s*/, "").replace(/[«»]/g, "")}» (${rules.dressDays} дн.)` : ""}. Итого ${somoni(price.total)}${price.discount ? ` со скидкой ${price.discountPercent}%` : ""}. Свяжитесь и поставьте время в день свадьбы.`,
        meta: { kind: "bridal-package", packageId: pkg.id },
      },
    });
    return { pkg, guest };
  });
  if ("error" in created) return { ok: false, field: "dress", error: t.errors.dress };

  // Trial look: a normal online booking (with its prepayment if the service asks for one)
  let trial: Extract<BridalResult, { ok: true }>["trial"];
  if (input.trial && rules.trialServiceId) {
    const res = await createGuestBooking({
      serviceId: rules.trialServiceId,
      staffId: null,
      date: input.trial.date,
      time: input.trial.time,
      name: input.name,
      phone: input.phone,
      source: "WEBSITE",
      guestId: created.guest.id,
      lang,
      includeHidden: true,
      note: `Свадебный пакет №${created.pkg.number}`,
    });
    if (res.ok) {
      await db.bridalPackage.update({ where: { id: created.pkg.id }, data: { trialAppointmentId: res.appointmentId } });
      trial = {
        ok: true,
        when: res.summary.when,
        ...(res.payment ? { payment: { amount: res.payment.amount, payBy: res.payment.payBy, url: localePath(lang, `/oplata/${res.payment.id}`) } } : {}),
      };
    } else trial = { ok: false, error: `${t.errors.trial} ${res.error}` };
  }
  return { ok: true, number: created.pkg.number, total: created.pkg.total, ...(trial ? { trial } : {}) };
}

// ─── CMS ─────────────────────────────────────────────────

export async function getBridalAdmin() {
  const today = todayYmd();
  const [rules, packages, services] = await Promise.all([
    getBridalRules(),
    db.bridalPackage.findMany({
      where: { OR: [{ weddingDate: { gte: dateOf(addDays(today, -14)) } }, { status: "NEW" }] },
      orderBy: [{ weddingDate: "asc" }],
      include: { dress: true, guest: { select: { id: true } } },
    }),
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const trials = await db.appointment.findMany({ where: { id: { in: packages.map((p) => p.trialAppointmentId).filter(Boolean) as string[] } } });
  return {
    rules,
    services,
    packages: packages.map((p) => {
      const trial = trials.find((a) => a.id === p.trialAppointmentId);
      const w = ymd(p.weddingDate);
      return {
        id: p.id,
        number: p.number,
        status: p.status,
        guestId: p.guest?.id ?? null,
        name: p.name,
        phone: p.phone,
        wedding: w,
        weddingLabel: longDate(atSalonTime(w, "12:00")),
        daysLeft: Math.round((Date.parse(w) - Date.parse(today)) / 864e5),
        services: p.services as { serviceId: string; name: string; price: number }[],
        dress: p.dress ? { name: p.dress.name, size: p.dress.size, days: p.dressDays, price: p.dressPrice } : null,
        subtotal: p.subtotal,
        discountPercent: p.discountPercent,
        total: p.total,
        note: p.note,
        trial: trial ? { id: trial.id, when: `${longDate(trial.startsAt)}, ${clock(trial.startsAt)}`, status: trial.status, deposit: trial.depositPaid >= trial.depositRequired } : null,
        createdAt: p.createdAt,
      };
    }),
  };
}

export async function setBridalStatus(id: string, status: "CONFIRMED" | "DONE" | "CANCELLED") {
  const p = await db.bridalPackage.findUnique({ where: { id } });
  if (!p) return { ok: false as const, error: "Пакет не найден" };
  await db.bridalPackage.update({ where: { id }, data: { status } });
  // A cancelled package frees its dress
  if (status === "CANCELLED") await db.dressBooking.deleteMany({ where: { bridalPackageId: id } });
  return { ok: true as const };
}

export async function saveBridalRules(input: { discountPercent: number; minServices: number; dressDays: number; trialServiceId: string | null }) {
  const rules = normalizeBridalRules(input);
  await db.setting.upsert({ where: { key: BRIDAL_SETTING }, update: { value: rules }, create: { key: BRIDAL_SETTING, value: rules } });
  return { ok: true as const };
}
