// Website "Онлайн-запись" form rules (same messages as the prototype). Shared by the form and the server.
import { normalizePhone } from "./phone";
import { isClosed, type Ymd } from "./time";

export type SiteBookingInput = { name: string; phone: string; date: string; service: string };
export type SiteBookingErrors = Partial<Record<keyof SiteBookingInput, string>>;

export function validateSiteBooking(v: SiteBookingInput, today: Ymd, services: string[]): SiteBookingErrors {
  const e: SiteBookingErrors = {};
  if (v.name.trim().length < 2) e.name = "Как к вам обращаться?";
  if (!normalizePhone(v.phone)) e.phone = "Нужно 9 цифр, например 98 103 11 11";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.date = "Выберите дату";
  else if (v.date < today) e.date = "Эта дата уже прошла";
  else if (isClosed(v.date)) e.date = "По понедельникам мы отдыхаем";
  if (!services.includes(v.service)) e.service = "Выберите услугу";
  return e;
}
