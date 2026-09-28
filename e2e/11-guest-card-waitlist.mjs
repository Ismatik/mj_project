// Guest card (allergies, colour formulas, private before/after photos, birthdays), the walk-in queue
// and the waitlist: a cancelled booking is offered to the waiting guest, who confirms by link; decline and expiry pass it on.
// Run against a freshly seeded app:  npm run db:seed && node e2e/11-guest-card-waitlist.mjs  (needs DATABASE_URL)
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const text = async (p, sel) => ((await p.textContent(sel)) ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ');
const sql = (q) => execSync(`psql "${process.env.DATABASE_URL}" -tAc ${JSON.stringify(q)}`).toString().trim();

const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const ctxOf = async () => {
  const c = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe', extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.11' } });
  await c.route(/unsplash|mino\.tj/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await c.addInitScript(() => sessionStorage.setItem('mj-intro', '1'));
  return c;
};
const pageOf = async (c) => {
  const p = await c.newPage();
  p.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  return p;
};
async function login(name) {
  const p = await pageOf(await ctxOf());
  await p.goto(BASE + '/login');
  await p.fill('input[name=login]', name);
  await p.fill('input[name=password]', 'change-me-now');
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}

try {
  // ── Guest card ────────────────────────────────────────
  const r = await login('reception');
  await r.goto(BASE + '/cms/guests');
  const marta = await text(r, 'a:has-text("Марта Каримова")');
  check('guest book marks allergies', marta.includes('!'));
  await r.goto(BASE + '/cms/guests?tag=birthdays');
  check('birthdays in the next two weeks', (await text(r, 'main')).includes('Марта Каримова') && !(await text(r, 'main')).includes('София Рахимова'));
  await r.click('a:has-text("Марта Каримова")');
  await r.waitForSelector('text=Формулы окрашивания');
  const card = await text(r, '[aria-label="Карточка: Марта Каримова"]');
  check('allergy banner and formulas on the card', card.includes('Аммиак') && card.includes('Blondor') && card.includes('исполнится'));
  await r.click('button:has-text("+ Записать формулу")');
  await r.fill('form[aria-label="Новая формула"] input[name=title]', 'Корни');
  await r.fill('form[aria-label="Новая формула"] textarea[name=formula]', 'Igora 7-1 + 6% 1:1, 35 мин');
  await r.selectOption('form[aria-label="Новая формула"] select', { index: 1 });
  await r.click('button:has-text("Сохранить формулу")');
  await r.waitForSelector('code:has-text("Igora 7-1 + 6% 1:1")');
  check('formula saved', sql(`select count(*) from "ColourFormula" where formula like 'Igora 7-1%' and "appointmentId" is not null`) === '1');

  // Before/after photo: private
  await r.setInputFiles('[aria-label="Добавить фото"] input[type=file]', new URL('./fixtures/test.png', import.meta.url).pathname);
  await r.selectOption('select[aria-label="До или после"]', 'AFTER');
  await r.fill('[aria-label="Добавить фото"] input[name=caption]', 'Балаяж, итог');
  await r.click('button:has-text("Добавить фото")');
  await r.waitForSelector('figure:has-text("Балаяж, итог") img');
  const shown = await r.$eval('figure:has-text("Балаяж, итог") img', (img) => img.complete && img.naturalWidth > 0);
  check('photo uploaded and shown', shown);
  const photoUrl = await r.getAttribute('figure:has-text("Балаяж, итог") img', 'src');
  const anon = await (await b.newContext()).request.get(BASE + photoUrl);
  check('photo is not public', anon.status() === 404, String(anon.status()));
  await r.screenshot({ path: out + '/guest-card.png', fullPage: true });

  // Allergies for Anna, seen by her master in the calendar
  await r.goto(BASE + '/cms/guests');
  await r.click('a:has-text("Анна Литвинова")');
  await r.click('text=Изменить карточку');
  await r.fill('textarea >> nth=0', 'Никель, клей для ресниц с цианоакрилатом');
  await r.click('button:has-text("Сохранить")');
  await r.waitForSelector('[role=note]:has-text("Никель")');
  check('allergies saved', true);

  const annaAppt = sql(`select a.id from "Appointment" a join "AppointmentStaff" s on s."appointmentId" = a.id join "Staff" m on m.id = s."staffId" where a."guestName" like 'Анна%' and m.name = 'Мира' and a.status <> 'DONE' order by a."startsAt" limit 1`);
  const m = await login('mira');
  await m.goto(BASE + `/cms/calendar?appt=${annaAppt}`);
  await m.waitForSelector('section[aria-label="Запись"]');
  const panel = await text(m, 'section[aria-label="Запись"]');
  check('master sees allergies and formulas', panel.includes('Никель') && panel.includes('Состав 1'), panel.slice(0, 160));
  await m.click('section[aria-label="Запись"] button:has-text("+ Записать формулу")');
  await m.fill('form[aria-label="Новая формула"] input[name=title]', 'Ламинирование');
  await m.fill('form[aria-label="Новая формула"] textarea[name=formula]', 'Состав 1 — 8 мин, состав 2 — 7 мин');
  await m.click('button:has-text("Сохранить формулу")');
  await m.waitForSelector('code:has-text("состав 2 — 7 мин")');
  check('master records a formula for her visit', sql(`select count(*) from "ColourFormula" f join "Staff" s on s.id = f."staffId" where s.name = 'Мира' and f."appointmentId" = '${annaAppt}'`) === '1');

  // ── Walk-ins ──────────────────────────────────────────
  await r.goto(BASE + '/cms/waitlist');
  check('walk-in queue shows who waits', (await text(r, 'tr[data-walkin="Мадина"]')).includes('ждёт'));
  await r.click('tr[data-walkin="Мадина"] button:has-text("Посадить")');
  await r.waitForSelector('text=/Мадина — к мастеру/');
  check('walk-in seated', sql(`select status || '/' || source from "Appointment" where "guestName" = 'Мадина'`) === 'IN_CHAIR/WALK_IN');
  await r.fill('form[aria-label="Живая очередь"] input[name=name]', 'Тахмина');
  await r.selectOption('form[aria-label="Живая очередь"] select[name=service]', { label: 'Стрижка + укладка' });
  await r.click('button:has-text("Поставить в очередь")');
  await r.waitForSelector('tr[data-walkin="Тахмина"]');
  await r.click('tr[data-walkin="Тахмина"] button:has-text("Ушла")');
  await r.waitForSelector('tr[data-walkin="Тахмина"]', { state: 'detached' });
  check('walk-in who left', (await text(r, 'main')).includes('ушла'));

  // ── Waitlist: a booking is cancelled, the time goes to the waiting guest ──
  const g = await pageOf(await ctxOf());
  await g.goto(BASE + '/#zapis');
  await g.click('#zapis [role=tab]:has-text("Ногти")');
  await g.click('#zapis button:has-text("Педикюр")');
  await g.locator('#zapis button:has(small)').nth(4).click();
  await g.waitForFunction(() => [...document.querySelectorAll('#zapis button')].some((x) => /^\d\d:00$/.test(x.textContent.trim())));
  const t = await g.$$eval('#zapis button', (bs) => bs.map((x) => x.textContent.trim()).find((x) => /^(09|1[0-6]):00$/.test(x)));
  await g.click(`#zapis button:text-is("${t}")`);
  await g.fill('input[name=name]', 'Ойша Назарова');
  await g.fill('input[name=phone]', '93 777 10 01');
  await g.click(`#zapis button:has-text("Записаться на ${t}")`);
  await g.waitForSelector('text=/Вы записаны|Заявка/');
  const day = sql(`select to_char("startsAt" at time zone 'Asia/Dushanbe', 'YYYY-MM-DD') from "Appointment" where "guestName" like 'Ойша%'`);

  // Website: join the waitlist for a late time on that day (nothing free then → just waits)
  await g.goto(BASE + '/?again=1#zapis');
  await g.click('#zapis [role=tab]:has-text("Ногти")');
  await g.click('#zapis button:has-text("Педикюр")');
  await g.locator('#zapis button:has(small)').nth(4).click();
  await g.waitForSelector('#zapis button:has-text("Сообщить, если освободится")');
  await g.click('#zapis button:has-text("Сообщить, если освободится")');
  await g.fill('input[name=wl-name]', 'Мехри Саидова');
  await g.fill('input[name=wl-phone]', '93 777 10 04');
  await g.selectOption('[aria-label="с"]', '17:00');
  await g.click('#zapis button:has-text("Встать в лист ожидания")');
  await g.waitForSelector('#zapis [role=status]:has-text("Вы в листе ожидания")');
  check('website waitlist', sql(`select "timeFrom" || '/' || source from "WaitlistEntry" where name = 'Мехри Саидова'`) === '17:00/WEBSITE');

  // Reception adds two guests waiting for exactly that time
  const addEntry = async (name, phone) => {
    await r.goto(BASE + '/cms/waitlist');
    const f = 'form[aria-label="Лист ожидания"]';
    await r.fill(`${f} input[name=name]`, name);
    await r.fill(`${f} input[name=phone]`, phone);
    await r.selectOption(`${f} select[name=service]`, { label: 'Педикюр' });
    await r.selectOption(`${f} select[name=date]`, day);
    await r.selectOption(`${f} select[aria-label="С"]`, t === '09:00' ? '' : t);
    await r.selectOption(`${f} select[aria-label="До"]`, t);
    await r.click('button:has-text("Добавить в лист ожидания")');
    await r.waitForSelector(`tr[data-entry="${name}"]`);
  };
  await addEntry('Зебо Рахимова', '93 777 10 02');
  await addEntry('Нилуфар Каримова', '93 777 10 03');
  check('nobody offered while the time is taken', sql(`select count(*) from "WaitlistEntry" where status = 'OFFERED'`) === '0');

  const ojsha = sql(`select id from "Appointment" where "guestName" like 'Ойша%'`);
  await r.goto(BASE + `/cms/calendar?week=${day}&appt=${ojsha}`);
  await r.click('section[aria-label="Запись"] button:has-text("Отменить")');
  await r.waitForTimeout(1500);
  check('cancelled time offered to the first guest', sql(`select name from "WaitlistEntry" where status = 'OFFERED'`) === 'Зебо Рахимова');
  const token = sql(`select token from "WaitlistEntry" where name = 'Зебо Рахимова'`);
  check('offer message with a link', Number(sql(`select count(*) from "OutboxMessage" where body like '%освободилось время%' and body like '%/ochered/${token}%'`)) === 1);
  check('time held for her', sql(`select a.status || '/' || (a."holdUntil" is not null) from "WaitlistEntry" e join "Appointment" a on a.id = e."offerId" where e.token = '${token}'`) === 'PENDING/true');
  await r.goto(BASE + '/cms/waitlist');
  check('reception sees the offer', (await text(r, `tr[data-entry="Зебо Рахимова"]`)).includes('Предложено'));

  // She declines → offered to the next one
  await g.goto(BASE + `/ochered/${token}`);
  check('offer page', (await text(g, 'main')).includes('Педикюр') && (await text(g, 'main')).includes('Мы держим его за вами'));
  await g.screenshot({ path: out + '/waitlist-offer.png' });
  await g.click('button:has-text("Не подходит")');
  await g.waitForSelector('text=предложим это время другой гостье');
  check('declined and passed on', sql(`select name from "WaitlistEntry" where status = 'OFFERED'`) === 'Нилуфар Каримова');

  // The next one accepts
  const token2 = sql(`select token from "WaitlistEntry" where name = 'Нилуфар Каримова'`);
  await g.goto(BASE + `/en/ochered/${token2}`);
  check('offer page in English', (await text(g, 'main')).includes('A time has opened up'));
  await g.click('button:has-text("Book it")');
  await g.waitForSelector("text=You're booked");
  check('accepted: booking confirmed', sql(`select a.status || '/' || e.status || '/' || (g.phone is not null) from "WaitlistEntry" e join "Appointment" a on a.id = e."offerId" join "Guest" g on g.id = a."guestId" where e.token = '${token2}'`) === 'CONFIRMED/BOOKED/true');
  check('reception told', Number(sql(`select count(*) from "OutboxMessage" where body like '%Нилуфар Каримова подтвердила время%'`)) === 1);

  // An unanswered offer expires and the time is released
  await r.goto(BASE + '/cms/waitlist');
  await r.fill('form[aria-label="Лист ожидания"] input[name=name]', 'Сабина');
  await r.fill('form[aria-label="Лист ожидания"] input[name=phone]', '93 777 10 05');
  await r.selectOption('form[aria-label="Лист ожидания"] select[name=service]', { label: 'Педикюр' });
  await r.selectOption('form[aria-label="Лист ожидания"] select[name=date]', day);
  await r.click('button:has-text("Добавить в лист ожидания")');
  await r.waitForTimeout(1200);
  const offered = sql(`select status from "WaitlistEntry" where name = 'Сабина'`);
  check('a free time is offered straight away', offered === 'OFFERED', offered);
  sql(`update "WaitlistEntry" set "offerExpiresAt" = now() - interval '1 minute' where name = 'Сабина'`);
  const o = await login('mavzuna');
  await o.goto(BASE + '/cms/integrations');
  await o.click('button:has-text("Доставить сейчас")');
  await o.waitForSelector('text=Обработано сообщений');
  check('unanswered offer expired, time released', sql(`select e.status || '/' || a.status from "WaitlistEntry" e join "Appointment" a on a.id = e."offerId" where e.name = 'Сабина'`) === 'EXPIRED/CANCELLED');
  await r.goto(BASE + '/cms/waitlist');
  await r.screenshot({ path: out + '/waitlist.png', fullPage: true });
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
} finally {
  await b.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exit(1);
