import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { cancelAlert, masterAddress, newBookingAlert, queueMasterDayPlans, rescheduleAlert, staffIdFromAddress } from "./master-alerts";

const AT = (hhmm: string) => new Date(`2026-10-05T${hhmm}:00+05:00`); // Dushanbe
const VISIT = { guestName: "Фарзона", phone: "+992981031111", serviceLabel: "Маникюр", startsAt: AT("14:00") };

/** Only the two tables these functions touch. */
function fakeDb(opts: { linked?: string[]; visits?: { staffId: string; guestName: string; phone?: string | null; serviceLabel: string; startsAt: Date }[] } = {}) {
  const linked = opts.linked ?? [];
  const created: { to: string; body: string }[] = [];
  const db = {
    telegramChat: {
      // Two callers: linkedChats asks for one master by id, the day plan asks for all of them.
      findMany: async ({ where }: { where: { staffId?: unknown } }) =>
        typeof where.staffId === "string" ? linked.filter((id) => id === where.staffId).map((id) => ({ id: `chat-${id}` })) : linked.map((id) => ({ staffId: id })),
    },
    appointment: {
      findMany: async () =>
        (opts.visits ?? []).map((v) => ({
          guestName: v.guestName,
          guest: v.phone === undefined ? { phone: "+992981031111" } : v.phone ? { phone: v.phone } : null,
          serviceLabel: v.serviceLabel,
          startsAt: v.startsAt,
          staff: [{ staffId: v.staffId }],
        })),
    },
    outboxMessage: {
      createMany: async ({ data }: { data: { to: string; body: string }[] }) => void created.push(...data),
    },
  } as unknown as PrismaClient;
  return { db, created };
}

describe("where a master's alerts are addressed", () => {
  it("round-trips the staff id", () => {
    expect(staffIdFromAddress(masterAddress("mira"))).toBe("mira");
  });

  // Reception alerts and simulator chats share the "to" column, so they must not be mistaken for one.
  it.each(["reception", "sim-1", "+992981031111"])("leaves %s alone", (to) => {
    expect(staffIdFromAddress(to)).toBeNull();
  });
});

describe("an alert is only built when there is somewhere to send it", () => {
  it("is null for a master who never linked a chat", async () => {
    const { db } = fakeDb({ linked: [] });
    expect(await newBookingAlert(db, "mira", VISIT, { appointmentId: "a1" })).toBeNull();
  });

  it("is null when the booking has no master at all", async () => {
    const { db } = fakeDb({ linked: ["mira"] });
    expect(await newBookingAlert(db, null, VISIT, { appointmentId: "a1" })).toBeNull();
  });

  it("carries the guest, the service and the time", async () => {
    const { db } = fakeDb({ linked: ["mira"] });
    const row = await newBookingAlert(db, "mira", VISIT, { appointmentId: "a1" });
    expect(row?.to).toBe("staff:mira");
    expect(row?.body).toContain("Новая запись к вам");
    expect(row?.body).toContain("Фарзона");
    expect(row?.body).toContain("Маникюр");
    expect(row?.body).toContain("14:00");
  });

  it("says the time is only held until a prepayment lands", async () => {
    const { db } = fakeDb({ linked: ["mira"] });
    const row = await newBookingAlert(db, "mira", VISIT, { appointmentId: "a1", deposit: 150 });
    expect(row?.body).toContain("держится до предоплаты");
  });

  it("tells her a cancelled slot is hers again", async () => {
    const { db } = fakeDb({ linked: ["mira"] });
    expect((await cancelAlert(db, "mira", VISIT, "a1"))?.body).toContain("освободилось");
  });

  it("gives both the new time and the old one when a visit moves", async () => {
    const { db } = fakeDb({ linked: ["mira"] });
    const row = await rescheduleAlert(db, "mira", VISIT, AT("11:00"), "a1");
    expect(row?.body).toContain("14:00"); // now
    expect(row?.body).toContain("11:00"); // was
  });

  // The salon chose to include it: a master calls her own guest to confirm.
  it("includes the phone number", async () => {
    const { db } = fakeDb({ linked: ["mira"] });
    expect((await newBookingAlert(db, "mira", VISIT, { appointmentId: "a1" }))?.body).toContain("+992 98 103-11-11");
  });
});

describe("the morning plan", () => {
  const DAY: [Date, Date] = [AT("00:00"), new Date(AT("00:00").getTime() + 86400_000)];

  it("gives each linked master her own visits, and nobody else's", async () => {
    const { db, created } = fakeDb({
      linked: ["mira", "zarina"],
      visits: [
        { staffId: "mira", guestName: "Фарзона", serviceLabel: "Маникюр", startsAt: AT("10:00") },
        { staffId: "zarina", guestName: "Нигина", serviceLabel: "Укладка", startsAt: AT("12:00") },
        { staffId: "mira", guestName: "Сабина", serviceLabel: "Брови", startsAt: AT("15:00") },
      ],
    });
    expect(await queueMasterDayPlans(db, ...DAY)).toBe(2);
    const mira = created.find((m) => m.to === "staff:mira")!;
    expect(mira.body).toContain("Фарзона");
    expect(mira.body).toContain("Сабина");
    expect(mira.body).not.toContain("Нигина");
  });

  // Silence would read as a broken bot, so an empty day is said out loud.
  it("still writes to a master with nothing booked", async () => {
    const { db, created } = fakeDb({ linked: ["mira"], visits: [] });
    expect(await queueMasterDayPlans(db, ...DAY)).toBe(1);
    expect(created[0]!.body).toContain("записей пока нет");
  });

  it("writes nothing at all when no master has linked a chat", async () => {
    const { db, created } = fakeDb({ linked: [], visits: [{ staffId: "mira", guestName: "Фарзона", serviceLabel: "Маникюр", startsAt: AT("10:00") }] });
    expect(await queueMasterDayPlans(db, ...DAY)).toBe(0);
    expect(created).toEqual([]);
  });

  it("copes with a walk-in who has no phone on file", async () => {
    const { db, created } = fakeDb({ linked: ["mira"], visits: [{ staffId: "mira", guestName: "Фарзона", phone: null, serviceLabel: "Маникюр", startsAt: AT("10:00") }] });
    await queueMasterDayPlans(db, ...DAY);
    expect(created[0]!.body).toContain("Фарзона");
    expect(created[0]!.body).not.toContain("undefined");
  });
});
