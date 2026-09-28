import "server-only";
import { clock, somoni } from "@/lib/format";
import { paymentMethod } from "@/lib/labels";
import { monthTitle } from "@/lib/payroll";
import { addDays, todayYmd, type Ymd } from "@/lib/time";
import { ReportPdf } from "../pdf/report";
import type { Payroll } from "../payroll";
import type { getShift } from "../shift";
import type { PeriodReport } from "./period";
import { xlsx, type Sheet } from "./xlsx";

// Excel and PDF versions of the period report, the payroll and the Z-report (end-of-day shift close).

export const dmy = (ymd: Ymd) => ymd.split("-").reverse().join(".");
const generated = () => `${dmy(todayYmd())}, ${clock(new Date())}`;
const PURPOSE: Record<string, string> = { DEPOSIT: "Предоплата за запись", GIFT_CARD: "Подарочный сертификат" };
const PROVIDER = (p: string) => (p === "pos" ? "касса" : p === "test" ? "тестовая оплата" : p);
const signed = (n: number) => (n > 0 ? `+${somoni(n)}` : n < 0 ? `–${somoni(-n)}` : somoni(0));
const periodLabel = (r: { from: Ymd; to: Ymd }) => `${dmy(r.from)} — ${dmy(addDays(r.to, -1))}`;

// ─── Period report ───────────────────────────────────────

export function periodXlsx(r: PeriodReport): Buffer {
  const s = r.summary;
  const title = "Mavzunai Jovid — отчёт за период";
  const sub = periodLabel(r);
  const sheets: Sheet[] = [
    {
      name: "Сводка",
      title,
      subtitle: sub,
      columns: [{ header: "Показатель", width: 44 }, { header: "Сумма, c.", width: 16, type: "money" }],
      rows: [
        ["Выручка (стоимость услуг)", s.revenue],
        ["Чеков", s.receipts],
        ["Средний чек", s.average],
        ["Оплачено наличными", s.cash],
        ["Оплачено картой", s.card],
        ["Оплачено по QR", s.qr],
        ["Зачтено онлайн-предоплат", s.deposits],
        ["Оплачено сертификатами", s.gifts],
        ["Оплачено бонусами", s.bonus],
        ["Скидки по акциям и промокодам", s.discounts],
        ["Начислено бонусов", s.bonusEarned],
        ["Продано сертификатов (всего)", s.giftCardsSold],
        ["  из них на кассе", s.giftCardsSoldTill],
        ["Получено онлайн-предоплат", s.onlinePrepayments],
      ],
    },
    {
      name: "Чеки",
      title,
      subtitle: sub,
      columns: [
        { header: "Чек №", width: 8, type: "number" },
        { header: "Дата и время", width: 17, type: "datetime" },
        { header: "Гостья", width: 22 },
        { header: "Телефон", width: 15 },
        { header: "Мастер", width: 12 },
        { header: "Услуги", width: 36 },
        { header: "Акция", width: 14 },
        { header: "Стоимость", width: 11, type: "money" },
        { header: "Скидка", width: 9, type: "money" },
        { header: "Предоплата", width: 11, type: "money" },
        { header: "Сертификат", width: 11, type: "money" },
        { header: "Бонусы", width: 9, type: "money" },
        { header: "Оплачено", width: 11, type: "money" },
        { header: "Способ", width: 11 },
      ],
      rows: r.receipts.map((x) => [x.number, x.at, x.guest, x.phone, x.master, x.services, x.promo, x.total, x.discount, x.deposit, x.gift, x.bonus, x.paid, paymentMethod[x.method]]),
      totals: ["Итого", null, null, null, null, null, null, s.revenue, s.discounts, s.deposits, s.gifts, s.bonus, s.cash + s.card + s.qr, null],
    },
    {
      name: "Услуги",
      title,
      subtitle: sub,
      columns: [{ header: "Услуга", width: 36 }, { header: "Кол-во", width: 9, type: "number" }, { header: "Выручка, c.", width: 13, type: "money" }, { header: "Скидки, c.", width: 12, type: "money" }],
      rows: r.services.map((x) => [x.name, x.count, x.revenue, x.discounts]),
      totals: ["Итого", r.services.reduce((a, x) => a + x.count, 0), s.revenue, s.discounts],
    },
    {
      name: "Мастера",
      title,
      subtitle: `${sub} · процент — по текущей ставке мастера`,
      columns: [
        { header: "Мастер", width: 18 },
        { header: "Чеков", width: 8, type: "number" },
        { header: "Услуг", width: 8, type: "number" },
        { header: "Выручка, c.", width: 13, type: "money" },
        { header: "Процент", width: 9, type: "percent" },
        { header: "Комиссия, c.", width: 13, type: "money" },
      ],
      rows: r.masters.map((m) => [m.name, m.receipts, m.services, m.revenue, m.commissionPct / 100, m.commission]),
      totals: ["Итого", s.receipts, r.masters.reduce((a, m) => a + m.services, 0), s.revenue, null, r.masters.reduce((a, m) => a + m.commission, 0)],
    },
    {
      name: "По дням",
      title,
      subtitle: sub,
      columns: [
        { header: "День", width: 12 },
        { header: "Чеков", width: 8, type: "number" },
        { header: "Выручка, c.", width: 13, type: "money" },
        { header: "Наличные", width: 12, type: "money" },
        { header: "Карта", width: 12, type: "money" },
        { header: "QR", width: 12, type: "money" },
      ],
      rows: r.days.map((d) => [dmy(d.day), d.receipts, d.revenue, d.cash, d.card, d.qr]),
      totals: ["Итого", s.receipts, s.revenue, s.cash, s.card, s.qr],
    },
    {
      name: "Оплаты вне чеков",
      title,
      subtitle: `${sub} · онлайн-предоплаты и продажа сертификатов`,
      columns: [{ header: "Дата и время", width: 17, type: "datetime" }, { header: "Что", width: 24 }, { header: "Описание", width: 40 }, { header: "Где", width: 16 }, { header: "Способ", width: 11 }, { header: "Сумма, c.", width: 12, type: "money" }],
      rows: r.payments.map((p) => [p.at, PURPOSE[p.purpose] ?? p.purpose, p.description, PROVIDER(p.provider), p.method ? paymentMethod[p.method] : "онлайн", p.amount]),
      totals: ["Итого", null, null, null, null, r.payments.reduce((a, p) => a + p.amount, 0)],
    },
    {
      name: "Смены",
      title,
      subtitle: sub,
      columns: [
        { header: "День", width: 12 },
        { header: "Чеков", width: 8, type: "number" },
        { header: "Выручка", width: 12, type: "money" },
        { header: "На начало", width: 11, type: "money" },
        { header: "Наличные", width: 11, type: "money" },
        { header: "Карта", width: 11, type: "money" },
        { header: "QR", width: 11, type: "money" },
        { header: "Внесено", width: 10, type: "money" },
        { header: "Изъято", width: 10, type: "money" },
        { header: "Ожидалось", width: 11, type: "money" },
        { header: "Посчитано", width: 11, type: "money" },
        { header: "Разница", width: 10, type: "money" },
        { header: "Сдано", width: 10, type: "money" },
        { header: "Оставлено", width: 11, type: "money" },
        { header: "Закрыла", width: 14 },
      ],
      rows: r.shifts.map((x) => [dmy(x.ymd), x.receipts, x.revenue, x.openingCash, x.cashSales, x.cardSales, x.qrSales, x.cashIn, x.cashOut, x.expectedCash, x.countedCash, x.difference, x.handedOver, x.leftCash, x.closedBy]),
    },
  ];
  return xlsx(sheets);
}

export async function periodPdf(r: PeriodReport): Promise<Uint8Array> {
  const s = r.summary;
  const pdf = await ReportPdf.create({ title: "Отчёт за период", subtitle: periodLabel(r), generated: generated(), landscape: true });
  pdf.figures([
    { label: "Выручка", value: somoni(s.revenue), strong: true },
    { label: "Чеков", value: String(s.receipts) },
    { label: "Средний чек", value: somoni(s.average) },
    { label: "Скидки по акциям", value: somoni(s.discounts) },
    { label: "Наличные", value: somoni(s.cash) },
    { label: "Карта", value: somoni(s.card) },
    { label: "QR", value: somoni(s.qr) },
    { label: "Бонусы · сертификаты · предоплаты", value: `${somoni(s.bonus)} · ${somoni(s.gifts)} · ${somoni(s.deposits)}` },
  ]);
  pdf.heading("Мастера");
  pdf.table(
    [
      { header: "Мастер", width: 3 },
      { header: "Чеков", width: 1, align: "right" },
      { header: "Услуг", width: 1, align: "right" },
      { header: "Выручка", width: 2, align: "right" },
      { header: "Процент", width: 1, align: "right" },
      { header: "Комиссия", width: 2, align: "right" },
    ],
    r.masters.map((m) => [m.name, String(m.receipts), String(m.services), somoni(m.revenue), `${m.commissionPct}%`, somoni(m.commission)]),
    { totals: ["Итого", String(s.receipts), String(r.masters.reduce((a, m) => a + m.services, 0)), somoni(s.revenue), "", somoni(r.masters.reduce((a, m) => a + m.commission, 0))], empty: "Чеков нет" },
  );
  pdf.heading("Услуги");
  pdf.table(
    [
      { header: "Услуга", width: 5 },
      { header: "Кол-во", width: 1, align: "right" },
      { header: "Выручка", width: 2, align: "right" },
      { header: "Скидки", width: 2, align: "right" },
    ],
    r.services.map((x) => [x.name, String(x.count), somoni(x.revenue), somoni(x.discounts)]),
    { totals: ["Итого", String(r.services.reduce((a, x) => a + x.count, 0)), somoni(s.revenue), somoni(s.discounts)], empty: "Услуг нет" },
  );
  pdf.heading("По дням");
  pdf.table(
    [
      { header: "День", width: 2 },
      { header: "Чеков", width: 1, align: "right" },
      { header: "Выручка", width: 2, align: "right" },
      { header: "Наличные", width: 2, align: "right" },
      { header: "Карта", width: 2, align: "right" },
      { header: "QR", width: 2, align: "right" },
    ],
    r.days.map((d) => [dmy(d.day), String(d.receipts), somoni(d.revenue), somoni(d.cash), somoni(d.card), somoni(d.qr)]),
    { totals: ["Итого", String(s.receipts), somoni(s.revenue), somoni(s.cash), somoni(s.card), somoni(s.qr)], empty: "Нет продаж" },
  );
  if (r.payments.length) {
    pdf.heading("Оплаты вне чеков");
    pdf.table(
      [
        { header: "Когда", width: 2 },
        { header: "Что", width: 3 },
        { header: "Описание", width: 5 },
        { header: "Где", width: 2 },
        { header: "Сумма", width: 2, align: "right" },
      ],
      r.payments.map((p) => [`${dmy(todayYmd(p.at))} ${clock(p.at)}`, PURPOSE[p.purpose] ?? p.purpose, p.description, `${PROVIDER(p.provider)}${p.method ? `, ${paymentMethod[p.method]}` : ""}`, somoni(p.amount)]),
      { totals: ["Итого", "", "", "", somoni(r.payments.reduce((a, p) => a + p.amount, 0))] },
    );
  }
  pdf.heading("Смены");
  pdf.table(
    [
      { header: "День", width: 2 },
      { header: "Чеков", width: 1, align: "right" },
      { header: "Выручка", width: 2, align: "right" },
      { header: "Наличные", width: 2, align: "right" },
      { header: "Ожидалось", width: 2, align: "right" },
      { header: "Посчитано", width: 2, align: "right" },
      { header: "Разница", width: 2, align: "right" },
      { header: "Сдано", width: 2, align: "right" },
      { header: "Закрыла", width: 2 },
    ],
    r.shifts.map((x) => [dmy(x.ymd), String(x.receipts), somoni(x.revenue), somoni(x.cashSales), somoni(x.expectedCash), somoni(x.countedCash), signed(x.difference), somoni(x.handedOver), x.closedBy]),
    { empty: "Закрытых смен нет" },
  );
  pdf.heading("Чеки");
  pdf.table(
    [
      { header: "№", width: 1 },
      { header: "Когда", width: 2 },
      { header: "Гостья", width: 3 },
      { header: "Мастер", width: 2 },
      { header: "Услуги", width: 6 },
      { header: "Стоимость", width: 2, align: "right" },
      { header: "Оплачено", width: 2, align: "right" },
      { header: "Способ", width: 2 },
    ],
    r.receipts.map((x) => [String(x.number), `${dmy(todayYmd(x.at))} ${clock(x.at)}`, x.guest || "—", x.master || "—", x.services, somoni(x.total), somoni(x.paid), paymentMethod[x.method]!]),
    { totals: ["", "", "", "", "Итого", somoni(s.revenue), somoni(s.cash + s.card + s.qr), ""], size: 7.5, empty: "Чеков нет" },
  );
  return pdf.save();
}

// ─── Payroll ─────────────────────────────────────────────

export function payrollXlsx(p: Payroll): Buffer {
  const t = p.totals;
  return xlsx([
    {
      name: "Зарплата",
      title: `Mavzunai Jovid — зарплата мастеров, ${monthTitle(p.month).toLowerCase()}`,
      subtitle: "Начислено = оклад + процент от выручки + премии − штрафы. К выплате = начислено − выплачено.",
      columns: [
        { header: "Мастер", width: 16 },
        { header: "Должность", width: 22 },
        { header: "Чеков", width: 8, type: "number" },
        { header: "Услуг", width: 8, type: "number" },
        { header: "Выручка", width: 12, type: "money" },
        { header: "Процент", width: 9, type: "percent" },
        { header: "Комиссия", width: 12, type: "money" },
        { header: "Оклад", width: 10, type: "money" },
        { header: "Премии", width: 10, type: "money" },
        { header: "Штрафы", width: 10, type: "money" },
        { header: "Начислено", width: 12, type: "money" },
        { header: "Выплачено", width: 12, type: "money" },
        { header: "К выплате", width: 12, type: "money" },
      ],
      rows: p.rows.map((r) => [r.staff.name, r.staff.title, r.receipts, r.services, r.revenue, r.staff.commission / 100, r.pay.commission, r.staff.salary, r.pay.bonuses, r.pay.fines, r.pay.earned, r.pay.paid, r.pay.due]),
      totals: ["Итого", null, t.receipts, t.services, t.revenue, null, t.commission, t.salary, t.bonuses, t.fines, t.earned, t.paid, t.due],
    },
    {
      name: "Премии и штрафы",
      columns: [{ header: "Мастер", width: 16 }, { header: "Когда", width: 10 }, { header: "Сумма, c.", width: 12, type: "money" }, { header: "Причина", width: 40 }, { header: "Кто", width: 14 }],
      rows: p.rows.flatMap((r) => r.adjustments.map((a) => [r.staff.name, a.at, a.amount, a.note, a.by ?? ""])),
    },
    {
      name: "Выплаты",
      columns: [{ header: "Мастер", width: 16 }, { header: "Когда", width: 16 }, { header: "Сумма, c.", width: 12, type: "money" }, { header: "Способ", width: 18 }, { header: "Комментарий", width: 30 }, { header: "Кто", width: 14 }],
      rows: p.rows.flatMap((r) => r.payouts.map((x) => [r.staff.name, x.at, x.amount, x.method === "CASH" ? "наличные из кассы" : "перевод", x.note ?? "", x.by ?? ""])),
    },
  ]);
}

export async function payrollPdf(p: Payroll): Promise<Uint8Array> {
  const t = p.totals;
  const pdf = await ReportPdf.create({ title: "Зарплата мастеров", subtitle: monthTitle(p.month), generated: generated(), landscape: true });
  pdf.figures([
    { label: "Начислено", value: somoni(t.earned), strong: true },
    { label: "Выплачено", value: somoni(t.paid) },
    { label: "К выплате", value: somoni(t.due) },
    { label: "Выручка мастеров", value: somoni(t.revenue) },
  ]);
  pdf.table(
    [
      { header: "Мастер", width: 3 },
      { header: "Услуг", width: 1, align: "right" },
      { header: "Выручка", width: 2, align: "right" },
      { header: "%", width: 1, align: "right" },
      { header: "Комиссия", width: 2, align: "right" },
      { header: "Оклад", width: 2, align: "right" },
      { header: "Премии", width: 2, align: "right" },
      { header: "Штрафы", width: 2, align: "right" },
      { header: "Начислено", width: 2, align: "right" },
      { header: "Выплачено", width: 2, align: "right" },
      { header: "К выплате", width: 2, align: "right" },
    ],
    p.rows.map((r) => [r.staff.name, String(r.services), somoni(r.revenue), `${r.staff.commission}%`, somoni(r.pay.commission), somoni(r.staff.salary), somoni(r.pay.bonuses), somoni(r.pay.fines), somoni(r.pay.earned), somoni(r.pay.paid), somoni(r.pay.due)]),
    { totals: ["Итого", String(t.services), somoni(t.revenue), "", somoni(t.commission), somoni(t.salary), somoni(t.bonuses), somoni(t.fines), somoni(t.earned), somoni(t.paid), somoni(t.due)] },
  );
  const adj = p.rows.flatMap((r) => r.adjustments.map((a) => [r.staff.name, a.at, signed(a.amount), a.note]));
  if (adj.length) {
    pdf.heading("Премии и штрафы");
    pdf.table([{ header: "Мастер", width: 2 }, { header: "Когда", width: 1 }, { header: "Сумма", width: 1, align: "right" }, { header: "Причина", width: 6 }], adj);
  }
  const pays = p.rows.flatMap((r) => r.payouts.map((x) => [r.staff.name, x.at, somoni(x.amount), x.method === "CASH" ? "наличные из кассы" : "перевод", x.note ?? ""]));
  if (pays.length) {
    pdf.heading("Выплаты");
    pdf.table([{ header: "Мастер", width: 2 }, { header: "Когда", width: 2 }, { header: "Сумма", width: 1, align: "right" }, { header: "Способ", width: 2 }, { header: "Комментарий", width: 4 }], pays);
  }
  pdf.signatures(["Владелица", "Бухгалтер"]);
  return pdf.save();
}

// ─── Z-report ────────────────────────────────────────────

export async function shiftPdf(s: NonNullable<Awaited<ReturnType<typeof getShift>>>): Promise<Uint8Array> {
  const d = s.details;
  const pdf = await ReportPdf.create({ title: `Закрытие смены ${dmy(s.ymd)}`, subtitle: `Z-отчёт · закрыла ${s.closedBy}, ${clock(s.closedAt)}`, generated: generated() });
  pdf.figures(
    [
      { label: "Выручка", value: somoni(s.revenue), strong: true },
      { label: "Чеков", value: String(s.receipts) },
      { label: "Разница в кассе", value: signed(s.difference) },
    ],
    3,
  );
  pdf.heading("Поступления");
  pdf.lines([
    { label: "Наличные (чеки и сертификаты)", value: somoni(s.cashSales) },
    { label: "Карта", value: somoni(s.cardSales) },
    { label: "QR", value: somoni(s.qrSales) },
    { label: "Всего деньгами", value: somoni(s.cashSales + s.cardSales + s.qrSales), bold: true },
    { label: "Зачтено онлайн-предоплат", value: somoni(d.deposits) },
    { label: "Оплачено сертификатами", value: somoni(d.gifts) },
    { label: "Оплачено бонусами", value: somoni(d.bonus) },
    { label: "Скидки по акциям", value: somoni(d.discounts) },
    { label: "Продано сертификатов на кассе", value: somoni(d.giftSold.cash + d.giftSold.card + d.giftSold.qr) },
    { label: "Онлайн за день (не в кассе): предоплаты · сертификаты", value: `${somoni(d.online.deposits)} · ${somoni(d.online.gifts)}` },
  ]);
  pdf.heading("Наличные в кассе");
  pdf.lines([
    { label: "На начало дня", value: somoni(s.openingCash) },
    { label: "+ наличные за день", value: somoni(s.cashSales) },
    { label: "+ внесено", value: somoni(s.cashIn) },
    { label: "– изъято и выплачено", value: somoni(s.cashOut) },
    { label: "Должно быть", value: somoni(s.expectedCash), bold: true },
    { label: "Посчитано", value: somoni(s.countedCash), bold: true },
    { label: s.difference > 0 ? "Излишек" : s.difference < 0 ? "Недостача" : "Разница", value: signed(s.difference), bold: true },
    { label: "Сдано владелице", value: somoni(s.handedOver) },
    { label: "Оставлено на завтра", value: somoni(s.leftCash) },
  ]);
  if (d.movements.length) {
    pdf.heading("Внесения и изъятия");
    pdf.table(
      [
        { header: "Время", width: 1 },
        { header: "За что", width: 5 },
        { header: "Кто", width: 2 },
        { header: "Сумма", width: 2, align: "right" },
      ],
      d.movements.map((m) => [m.at, m.note, m.by ?? "", signed(m.amount)]),
    );
  }
  pdf.heading("По мастерам");
  pdf.table(
    [
      { header: "Мастер", width: 4 },
      { header: "Чеков", width: 1, align: "right" },
      { header: "Выручка", width: 2, align: "right" },
    ],
    d.byMaster.map((m) => [m.name, String(m.receipts), somoni(m.revenue)]),
    { empty: "Чеков не было" },
  );
  if (s.note) pdf.paragraph(`Комментарий: ${s.note}`);
  pdf.signatures(["Администратор", "Владелица"]);
  return pdf.save();
}
