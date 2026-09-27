// Booking rules shared by the "+ Новая запись" form, the server action and (later) the website and Telegram bot.
import { normalizePhone } from "./phone";
import { isClosed, weekdayOf, type Ymd } from "./time";

export const OPEN_FROM = 8 * 60; // earliest start, 08:00 (bridal mornings)
export const LAST_START = 18 * 60; // latest start, 18:00

export type BookingInput = {
  guestId?: string | null;
  guestName: string;
  guestPhone: string;
  serviceId: string;
  staffIds: string[];
  date: Ymd;
  time: string; // HH:MM
  durationMin: number;
  price: number;
  note?: string;
};

export type Busy = { staffId: string; start: number; end: number; label: string };

export type BookingContext = {
  today: Ymd;
  nowMinutes: number;
  /** Working weekdays (0 = Mon) per staff id */
  workDays: Record<string, number[]>;
  staffNames: Record<string, string>;
  /** Other appointments of the chosen masters on the chosen date, minutes since midnight */
  busy: Busy[];
};

export type BookingErrors = Partial<Record<"guest" | "phone" | "service" | "staff" | "date" | "time" | "price", string>>;

export const toMinutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : NaN;
};

export const toClock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function validateBooking(input: BookingInput, ctx: BookingContext): BookingErrors {
  const e: BookingErrors = {};

  if (!input.guestId) {
    if (input.guestName.trim().length < 2) e.guest = "Как зовут гостью?";
    if (!normalizePhone(input.guestPhone)) e.phone = "Нужно 9 цифр, например 98 103 11 11";
  }
  if (!input.serviceId) e.service = "Выберите услугу";
  if (!input.staffIds.length) e.staff = "Выберите мастера";
  if (!Number.isInteger(input.price) || input.price < 0) e.price = "Цена в сомони, целое число";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) e.date = "Выберите дату";
  else if (input.date < ctx.today) e.date = "Эта дата уже прошла";
  else if (isClosed(input.date)) e.date = "По понедельникам салон не работает";

  const start = toMinutes(input.time);
  if (Number.isNaN(start)) e.time = "Укажите время";
  else if (start < OPEN_FROM || start > LAST_START) e.time = "Запись с 08:00 до 18:00";
  else if (input.date === ctx.today && start < ctx.nowMinutes) e.time = "Это время уже прошло";

  if (!e.date && !e.staff) {
    const wd = weekdayOf(input.date);
    const off = input.staffIds.filter((id) => !ctx.workDays[id]?.includes(wd));
    if (off.length) e.staff = `${off.map((id) => ctx.staffNames[id]).join(", ")} в этот день не работает`;
  }

  if (!e.time && !e.staff && !e.date) {
    const end = start + input.durationMin;
    const clash = ctx.busy.find((b) => input.staffIds.includes(b.staffId) && b.start < end && start < b.end);
    if (clash) {
      e.time = `${ctx.staffNames[clash.staffId]}: занято ${toClock(clash.start)}–${toClock(clash.end)} (${clash.label})`;
    }
  }
  return e;
}
