import { beforeEach, describe, expect, it } from "vitest";
import { handleUpdate, type BotDeps, type BotGuest, type BotReply, type BotState } from "./engine";

// In-memory stand-in for the database
function makeDeps() {
  const chats = new Map<string, { state: BotState; guestId?: string; isStaff: boolean }>();
  const guests: BotGuest[] = [{ id: "g-marta", name: "Марта Каримова", phone: "+992935012214" }];
  const booked: { id: string; guestId: string; serviceId: string; staffId: string | null; date: string; time: string; status: string }[] = [];
  const calls: string[] = [];
  const deps: BotDeps = {
    async getChat(id) {
      const c = chats.get(id) ?? { state: {}, isStaff: false };
      return { state: c.state, isStaff: c.isStaff, guest: guests.find((g) => g.id === c.guestId) ?? null };
    },
    async saveChat(id, patch) {
      const c = chats.get(id) ?? { state: {}, isStaff: false };
      chats.set(id, { ...c, ...(patch.state ? { state: patch.state } : {}), ...(patch.guestId ? { guestId: patch.guestId } : {}), ...(patch.isStaff ? { isStaff: true } : {}) });
    },
    async menu() {
      return [
        { id: "cat-brows", name: "Брови и ресницы", services: [{ id: "svc-lash", name: "Ламинирование ресниц", durationMin: 60, price: 340, staff: [{ id: "mira", name: "Мира" }] }] },
      ];
    },
    dates: () => ["2026-09-29", "2026-09-30", "2026-10-01"],
    async slots(_s, date) {
      const taken = booked.filter((b) => b.date === date && b.status !== "CANCELLED").map((b) => b.time);
      return ["10:00", "10:30", "11:00"].filter((t) => !taken.includes(t)).map((time) => ({ time }));
    },
    async book(i) {
      calls.push(`book ${i.serviceId} ${i.date} ${i.time} ${i.name} ${i.phone}`);
      if (booked.some((b) => b.date === i.date && b.time === i.time)) return { ok: false, error: "Это время только что заняли — выберите другое" };
      let g = guests.find((x) => x.phone === i.phone);
      if (!g) guests.push((g = { id: `g${guests.length}`, name: i.name, phone: i.phone }));
      await deps.saveChat(i.chatId, { guestId: g.id });
      booked.push({ id: `a${booked.length}`, guestId: g.id, serviceId: i.serviceId, staffId: i.staffId, date: i.date, time: i.time, status: "PENDING" });
      return { ok: true, summary: { service: "Ламинирование ресниц", master: "Мира", when: `${i.date}, ${i.time}` } };
    },
    async upcoming(guestId) {
      return booked
        .filter((b) => b.guestId === guestId && b.status === "PENDING")
        .map((b) => ({ id: b.id, service: "Ламинирование ресниц", serviceId: b.serviceId, startsAt: new Date(`${b.date}T${b.time}:00+05:00`), master: "Мира", staffId: "mira", status: "PENDING" }));
    },
    async cancel(id, guestId) {
      const b = booked.find((x) => x.id === id && x.guestId === guestId);
      if (!b) return { ok: false, error: "Запись не найдена" };
      b.status = "CANCELLED";
      return { ok: true };
    },
    async reschedule(id, guestId, date, time) {
      const b = booked.find((x) => x.id === id && x.guestId === guestId)!;
      b.date = date;
      b.time = time;
      return { ok: true, summary: { service: "Ламинирование ресниц", master: "Мира", when: `${date}, ${time}` } };
    },
    async findGuestByPhone(phone) {
      return guests.find((g) => g.phone === phone) ?? null;
    },
    async contacts() {
      return { phone: "+992 98 103 11 11", whatsapp: "992981031111", address: "ул. Бухоро, 23/25", district: "Душанбе", hours: "Вт–Вс 09:00–18:00", dayOff: "Понедельник — выходной" };
    },
    staffCode: async () => "MJ-4821",
    formatWhen: (d) => d.toISOString(),
  };
  return { deps, chats, booked, calls };
}

const texts = (r: BotReply[]) => r.map((x) => x.text).join("\n");
const buttons = (r: BotReply[]) => r.flatMap((x) => x.buttons?.flat() ?? []);

describe("Telegram bot", () => {
  let t: ReturnType<typeof makeDeps>;
  const send = (u: Partial<Parameters<typeof handleUpdate>[0]>) => handleUpdate({ chatId: "c1", firstName: "Зарина", ...u }, t.deps);
  beforeEach(() => {
    t = makeDeps();
  });

  it("greets on /start with the main menu", async () => {
    const r = await send({ text: "/start" });
    expect(texts(r)).toContain("Здравствуйте, Зарина!");
    expect(buttons(r).map((b) => b.data)).toEqual(["book", "my", "prices", "contacts"]);
  });

  it("books a slot end to end, asking for the phone once", async () => {
    await send({ data: "book" });
    await send({ data: "c:cat-brows" });
    const masters = await send({ data: "s:svc-lash" });
    expect(buttons(masters).map((b) => b.text)).toContain("Любой мастер");
    await send({ data: "m:any" });
    const times = await send({ data: "d:2026-09-29" });
    expect(buttons(times).map((b) => b.text)).toEqual(["10:00", "10:30", "11:00", "← Другой день"]);
    const ask = await send({ data: "t:10:30" });
    expect(ask[0]!.askContact).toBe(true);
    const confirm = await send({ contactPhone: "+992 93 111 22 33" });
    expect(texts(confirm)).toContain("Проверьте, пожалуйста");
    expect(texts(confirm)).toContain("Имя: Зарина");
    const done = await send({ data: "ok" });
    expect(texts(done)).toContain("Вы записаны");
    expect(t.calls).toEqual(["book svc-lash 2026-09-29 10:30 Зарина +992931112233"]);

    // Second booking: phone already known, straight to confirmation
    await send({ data: "s:svc-lash" });
    await send({ data: "m:mira" });
    await send({ data: "d:2026-09-30" });
    const again = await send({ data: "t:11:00" });
    expect(again[0]!.askContact).toBeFalsy();
    expect(texts(again)).toContain("Проверьте");
  });

  it("rejects a malformed phone and accepts a typed one", async () => {
    await send({ data: "s:svc-lash" });
    await send({ data: "m:any" });
    await send({ data: "d:2026-09-29" });
    await send({ data: "t:10:00" });
    expect(texts(await send({ text: "123" }))).toContain("Нужно 9 цифр");
    expect(texts(await send({ text: "93 111 22 33" }))).toContain("Проверьте");
  });

  it("recognises an existing guest by phone", async () => {
    await send({ data: "s:svc-lash" });
    await send({ data: "m:any" });
    await send({ data: "d:2026-09-29" });
    await send({ data: "t:10:00" });
    const r = await send({ contactPhone: "935012214" });
    expect(texts(r)).toContain("Узнала вас");
    expect(texts(r)).toContain("Имя: Марта Каримова");
  });

  it("offers other times when the slot is taken meanwhile", async () => {
    t.booked.push({ id: "x", guestId: "g-marta", serviceId: "svc-lash", staffId: "mira", date: "2026-09-29", time: "10:00", status: "PENDING" });
    await send({ data: "s:svc-lash" });
    await send({ data: "m:any" });
    await send({ data: "d:2026-09-30" });
    await send({ data: "t:10:00" });
    await send({ contactPhone: "931112233" });
    // someone else takes it
    t.booked.push({ id: "y", guestId: "other", serviceId: "svc-lash", staffId: "mira", date: "2026-09-30", time: "10:00", status: "PENDING" });
    const r = await send({ data: "ok" });
    expect(texts(r)).toContain("только что заняли");
    expect(buttons(r).map((b) => b.text)).not.toContain("10:00");
  });

  it("lists, cancels and reschedules the guest's bookings", async () => {
    const my0 = await send({ data: "my" });
    expect(my0[0]!.askContact).toBe(true);
    await send({ contactPhone: "935012214" });
    // book one
    await send({ data: "s:svc-lash" });
    await send({ data: "m:any" });
    await send({ data: "d:2026-09-29" });
    await send({ data: "t:10:00" });
    await send({ data: "ok" });
    const my = await send({ data: "my" });
    const move = buttons(my).find((b) => b.text === "Перенести")!;
    await send({ data: move.data });
    await send({ data: "rd:2026-10-01" });
    const moved = await send({ data: "rt:11:00" });
    expect(texts(moved)).toContain("Перенесли");
    expect(t.booked[0]).toMatchObject({ date: "2026-10-01", time: "11:00" });
    const cancel = buttons(await send({ data: "my" })).find((b) => b.text === "Отменить")!;
    expect(texts(await send({ data: cancel.data }))).toContain("Точно отменить");
    expect(texts(await send({ data: cancel.data.replace("x:", "xx:") }))).toContain("Запись отменена");
    expect(texts(await send({ data: "my" }))).toContain("нет предстоящих записей");
  });

  it("links a staff chat only with the right code", async () => {
    expect(texts(await send({ text: "/staff 0000" }))).toContain("Код не подошёл");
    expect(texts(await send({ text: "/staff MJ-4821" }))).toContain("уведомления ресепшена");
    expect(t.chats.get("c1")!.isStaff).toBe(true);
  });

  it("answers free text with the menu", async () => {
    const r = await send({ text: "привет" });
    expect(texts(r)).toContain("Я понимаю кнопки");
    expect(buttons(r).length).toBe(4);
  });
});
