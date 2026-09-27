import { describe, expect, it } from "vitest";
import { validateBooking, type BookingContext, type BookingInput } from "./booking";
import { formatPhone, normalizePhone } from "./phone";

const ctx: BookingContext = {
  today: "2026-09-27", // Sunday
  nowMinutes: 10 * 60,
  workDays: { petra: [1, 2, 3, 4, 5], mira: [1, 2, 4, 5, 6] },
  staffNames: { petra: "Петра", mira: "Мира" },
  busy: [{ staffId: "mira", start: 12 * 60, end: 13 * 60, label: "Ламинирование ресниц" }],
};

const base: BookingInput = {
  guestName: "Зарина Алиева",
  guestPhone: "93 111 22 33",
  serviceId: "svc",
  staffIds: ["mira"],
  date: "2026-09-27",
  time: "14:00",
  durationMin: 60,
  price: 340,
};

describe("validateBooking", () => {
  it("accepts a valid booking", () => {
    expect(validateBooking(base, ctx)).toEqual({});
  });

  it("requires a guest name and a 9-digit phone for new guests", () => {
    const e = validateBooking({ ...base, guestName: "З", guestPhone: "123" }, ctx);
    expect(e.guest).toBeDefined();
    expect(e.phone).toBeDefined();
    expect(validateBooking({ ...base, guestId: "g1", guestName: "", guestPhone: "" }, ctx)).toEqual({});
  });

  it("refuses Mondays and past dates", () => {
    expect(validateBooking({ ...base, date: "2026-09-28" }, ctx).date).toMatch(/понедельникам/);
    expect(validateBooking({ ...base, date: "2026-09-26" }, ctx).date).toMatch(/прошла/);
  });

  it("refuses times outside hours or already past today", () => {
    expect(validateBooking({ ...base, time: "19:00" }, ctx).time).toMatch(/08:00 до 18:00/);
    expect(validateBooking({ ...base, time: "09:30" }, ctx).time).toMatch(/прошло/);
  });

  it("knows who is off that day", () => {
    expect(validateBooking({ ...base, staffIds: ["petra"] }, ctx).staff).toBe("Петра в этот день не работает");
  });

  it("catches overlaps with the master's other bookings", () => {
    expect(validateBooking({ ...base, time: "11:30" }, ctx).time).toBe("Мира: занято 12:00–13:00 (Ламинирование ресниц)");
    expect(validateBooking({ ...base, time: "13:00" }, ctx)).toEqual({});
  });
});

describe("phone", () => {
  it("normalizes Tajik numbers", () => {
    expect(normalizePhone("98 103 11 11")).toBe("+992981031111");
    expect(normalizePhone("+992 98 103-11-11")).toBe("+992981031111");
    expect(normalizePhone("12345")).toBeNull();
    expect(formatPhone("+992935012214")).toBe("+992 93 501-22-14");
  });
});
