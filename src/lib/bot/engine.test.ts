import { beforeEach, describe, expect, it } from "vitest";
import type { Lang } from "../i18n/locales";
import { handleUpdate, type BotDeps, type BotGuest, type BotReply, type BotState } from "./engine";

// In-memory stand-in for the database
function makeDeps() {
  const chats = new Map<string, { state: BotState; guestId?: string; isStaff: boolean; lang?: Lang }>();
  const guests: BotGuest[] = [{ id: "g-marta", name: "Марта Каримова", phone: "+992935012214" }];
  const booked: { id: string; guestId: string; serviceId: string; staffId: string | null; date: string; time: string; status: string }[] = [];
  const calls: string[] = [];
  const deps: BotDeps = {
    async getChat(id) {
      const c = chats.get(id) ?? { state: {}, isStaff: false };
      return { state: c.state, isStaff: c.isStaff, guest: guests.find((g) => g.id === c.guestId) ?? null, lang: c.lang ?? null };
    },
    async saveChat(id, patch) {
      const c = chats.get(id) ?? { state: {}, isStaff: false };
      chats.set(id, { ...c, ...(patch.state ? { state: patch.state } : {}), ...(patch.guestId ? { guestId: patch.guestId } : {}), ...(patch.isStaff ? { isStaff: true } : {}), ...(patch.lang ? { lang: patch.lang } : {}) });
    },
    async menu(lang) {
      const en = lang === "en";
      return [
        {
          id: "cat-brows",
          name: en ? "Brows & lashes" : "Брови и ресницы",
          services: [{ id: "svc-lash", name: en ? "Lash lamination" : "Ламинирование ресниц", durationMin: 60, price: 340, staff: [{ id: "mira", name: en ? "Mira" : "Мира" }] }],
        },
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
    bonus: async () => ({ balance: 120, tier: "Серебро", percent: 7, maxSpendPercent: 30 }),
    offers: async () => [{ title: "Осенний маникюр", description: "", label: "−20%", until: "31 октября 2026", code: null }],
    async waitlist(i) {
      calls.push(`wait ${i.serviceId} ${i.date} ${i.name} ${i.phone}`);
      // Like the real one: she becomes a guest linked to this chat
      let g = guests.find((x) => x.phone === i.phone);
      if (!g) guests.push((g = { id: `g${guests.length}`, name: i.name, phone: i.phone }));
      await deps.saveChat(i.chatId, { guestId: g.id });
      return calls.filter((c) => c.startsWith(`wait ${i.serviceId} ${i.date}`)).length > 1 ? "already" : "joined";
    },
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
    expect(buttons(r).map((b) => b.data)).toEqual(["book", "my", "prices", "bonus", "offers", "contacts", "lang"]);
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

  it("puts her on the waitlist when a day is full", async () => {
    for (const time of ["10:00", "10:30", "11:00"]) t.booked.push({ id: time, guestId: "g-marta", serviceId: "svc-lash", staffId: "mira", date: "2026-10-01", time, status: "PENDING" });
    await send({ data: "s:svc-lash" });
    await send({ data: "m:mira" });
    const full = await send({ data: "d:2026-10-01" });
    expect(texts(full)).toContain("свободного времени нет");
    expect(buttons(full).find((b) => b.data === "w:2026-10-01")?.text).toBe("🔔 Сообщить, если освободится");
    const ask = await send({ data: "w:2026-10-01" });
    expect(ask[0]!.askContact).toBe(true);
    const joined = await send({ contactPhone: "93 111 22 33" });
    expect(texts(joined)).toContain("Вы в листе ожидания на");
    expect(t.calls).toEqual(["wait svc-lash 2026-10-01 Зарина +992931112233"]);
    // Again, phone already known
    await send({ data: "s:svc-lash" });
    await send({ data: "m:any" });
    await send({ data: "d:2026-10-01" });
    expect(texts(await send({ data: "w:2026-10-01" }))).toContain("уже в листе ожидания");
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
    expect(buttons(r).length).toBe(7);
  });
});

describe("Telegram bot languages", () => {
  it("takes the language from the Telegram app and remembers it", async () => {
    const { deps, chats } = makeDeps();
    const r = await handleUpdate({ chatId: "5", text: "/start", firstName: "Anna", languageCode: "en-GB" }, deps);
    expect(texts(r)).toContain("Hello, Anna!");
    expect(buttons(r).map((b) => b.text)).toContain("✦ Book");
    expect(chats.get("5")!.lang).toBe("en");
    const later = await handleUpdate({ chatId: "5", data: "book" }, deps);
    expect(buttons(later).map((b) => b.text)).toContain("Brows & lashes");
  });

  it("switches language from the menu", async () => {
    const { deps, chats } = makeDeps();
    await handleUpdate({ chatId: "6", text: "/start" }, deps);
    const pick = await handleUpdate({ chatId: "6", data: "lang" }, deps);
    expect(buttons(pick).map((b) => b.data)).toEqual(["lang:ru", "lang:tg", "lang:en", "menu"]);
    const r = await handleUpdate({ chatId: "6", data: "lang:tg" }, deps);
    expect(texts(r)).toContain("тоҷикӣ");
    expect(buttons(r).map((b) => b.text)).toContain("✦ Сабт шудан");
    expect(chats.get("6")!.lang).toBe("tg");
  });

  it("asks for the phone with a translated button", async () => {
    const { deps } = makeDeps();
    for (const data of ["lang:en", "book", "c:cat-brows", "s:svc-lash", "m:any", "d:2026-09-30"]) await handleUpdate({ chatId: "7", data }, deps);
    const r = await handleUpdate({ chatId: "7", data: "t:10:00" }, deps);
    expect(r[0]!.askContact).toBe(true);
    expect(r[0]!.contactLabel).toBe("📱 Share my number");
  });
});

describe("Telegram bot: bonus and offers", () => {
  it("shows offers to anyone and points to a known guest", async () => {
    const { deps } = makeDeps();
    const offers = await handleUpdate({ chatId: "8", data: "offers" }, deps);
    expect(texts(offers)).toContain("−20% — Осенний маникюр");
    const ask = await handleUpdate({ chatId: "8", data: "bonus" }, deps);
    expect(ask[0]!.askContact).toBe(true);
  });
});
