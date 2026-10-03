// Bonus points and promotions: offers on the website and in online booking, promo codes, points at the till,
// the guest card and account, the bot, the owner's loyalty page and birthday points.
// Run against a freshly seeded app:  npm run db:seed && node e2e/09-bonus-promotions.mjs  (needs DATABASE_URL)
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
/** Amounts are printed with non-breaking spaces */
const text = async (p, sel) => ((await p.textContent(sel)) ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
const sql = (q) => execSync(`psql "${process.env.DATABASE_URL}" -tAc ${JSON.stringify(q)}`).toString().trim();
const MARTA = '+992935012214';
const points = (phone) => Number(sql(`select "bonusBalance" from "Guest" where phone = '${phone}'`));

const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' - ' + extra : ''}`);
// Its own client address: the website allows a few bookings per address an hour and earlier suites use them up
const ctxOf = async (w = 1360, h = 900) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe', extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.9' } });
  await c.route(/unsplash|mino\.tj/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await c.addInitScript(() => sessionStorage.setItem('mj-intro', '1'));
  return c;
};
const pageOf = async (ctx) => {
  const p = await ctx.newPage();
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
async function pickSlot(g) {
  await g.locator('#zapis button:has(small)').nth(4).click();
  await g.waitForFunction(() => [...document.querySelectorAll('#zapis button')].some((x) => /^\d\d:\d\d$/.test(x.textContent.trim())));
  const t = await g.$$eval('#zapis button', (bs) => bs.map((x) => x.textContent.trim()).find((x) => /^\d\d:\d\d$/.test(x)));
  await g.click(`#zapis button:text-is("${t}")`);
  return t;
}

try {
  // ── Website: offers section, discounted price in booking ─
  const g = await pageOf(await ctxOf());
  await g.goto(BASE + '/');
  const offers = await text(g, '#akcii');
  check('offers section on the site', offers.includes('Осенний уход за кожей') && offers.includes('−20%') && offers.includes('MJ10'), offers.slice(0, 120));
  await g.locator('#akcii').screenshot({ path: out + '/site-offers.png' });
  await g.goto(BASE + '/en');
  check('offers in English', (await text(g, '#akcii')).includes('Autumn skin care'));

  await g.goto(BASE + '/#zapis');
  await g.click('#zapis [role=tab]:has-text("Уход за кожей")');
  const skinBtn = await text(g, '#zapis button:has-text("Уход за кожей") >> nth=-1');
  check('booking shows the offer price', skinBtn.includes('520 c.') && skinBtn.includes('416 c.') && skinBtn.includes('акция −20%'), skinBtn);
  await g.click('#zapis button:has-text("Уход за кожей") >> nth=-1');
  const t1 = await pickSlot(g);
  await g.fill('input[name=name]', 'Дилором Шарипова');
  await g.fill('input[name=phone]', '93 700 11 22');
  await g.click(`#zapis button:has-text("Записаться на ${t1}")`);
  await g.waitForSelector('text=/Вы записаны|Заявка/');
  check('offer booked at the reduced price', sql(`select price || '/' || "fullPrice" from "Appointment" where "guestName" like 'Дилором%'`) === '416/520');

  // Promo code in the booking form (a new page load: the form still shows the finished booking)
  await g.goto(BASE + '/?again=1#zapis');
  await g.click('#zapis [role=tab]:has-text("Ногти")');
  await g.click('#zapis button:has-text("Педикюр")');
  const t2 = await pickSlot(g);
  await g.click('#zapis button:has-text("Есть промокод?")');
  await g.fill('#zapis input[aria-label="Промокод"]', 'nope');
  await g.click('#zapis button:has-text("Применить")');
  await g.waitForSelector('#zapis [role=alert]');
  check('unknown promo code refused', (await text(g, '#zapis [role=alert]')).includes('Такого промокода нет'));
  await g.fill('#zapis input[aria-label="Промокод"]', ' mj10 ');
  await g.click('#zapis button:has-text("Применить")');
  await g.waitForSelector('#zapis [role=status]:has-text("MJ10")');
  check('promo code applied in booking', (await text(g, '#zapis [role=status]')).includes('288 c. вместо 320 c.'));
  await g.fill('input[name=name]', 'Ширин Каримова');
  await g.fill('input[name=phone]', '93 700 33 44');
  await g.click(`#zapis button:has-text("Записаться на ${t2}")`);
  await g.waitForSelector('text=/Вы записаны|Заявка/');
  check('promo booking saved and counted', sql(`select price || '/' || "fullPrice" from "Appointment" where "guestName" like 'Ширин%'`) === '288/320' && sql(`select "usedCount" from "Promotion" where code = 'MJ10'`) === '1');

  // ── Till: offer price, points, promo code ─────────────
  const r = await login('reception');
  await r.goto(BASE + '/cms/pos');
  await r.click('button:has-text("Уход за кожей")');
  const c1 = await text(r, '#check');
  check('till applies the offer', c1.includes('416 c.') && c1.includes('скидка 104 c.'), c1.slice(0, 160));
  await r.fill('input[aria-label="Телефон гостьи"]', '93 501 22 14');
  await r.click('button:has-text("Найти")');
  await r.waitForSelector('[aria-label="Бонусы гостьи"]');
  const before = points(MARTA);
  const bonusText = await text(r, '[aria-label="Бонусы гостьи"]');
  check('guest points shown at the till', bonusText.includes(`Бонусы: ${before}`), bonusText);
  await r.click('[aria-label="Бонусы гостьи"] button:has-text("все")');
  const cap = Math.min(before, Math.floor(416 * 0.3));
  await r.waitForSelector(`text=/К оплате/`);
  await r.click('button:has-text("Наличные")');
  await r.waitForSelector('text=/Оплата .* принята/', { timeout: 10000 });
  const msg = await text(r, 'body');
  const earned = Number(msg.match(/начислено (\d+) б\./)?.[1] ?? 0);
  check('paid partly with points', msg.includes(`бонусы ${cap} c.`) && msg.includes(`Оплата ${416 - cap} c. принята`) && earned > 0, `cap ${cap}, earned ${earned}`);
  check('points balance updated', points(MARTA) === before - cap + earned, `${before} → ${points(MARTA)}`);
  await r.screenshot({ path: out + '/pos-bonus.png', fullPage: true });

  await r.goto(BASE + '/cms/pos');
  await r.click('button:has-text("Стрижка + укладка")');
  await r.fill('input[aria-label="Промокод"]', 'mj10');
  await r.click('input[aria-label="Промокод"] ~ button');
  await r.waitForSelector('text=Промокод MJ10');
  check('promo code at the till', (await text(r, '#check')).includes('162 c.'));
  await r.click('button:has-text("Карта")');
  await r.waitForSelector('text=/Оплата 162 c. принята/', { timeout: 10000 });
  check('promo receipt paid', sql(`select "usedCount" from "Promotion" where code = 'MJ10'`) === '2');

  // ── Owner: guest card, manual points, loyalty page ────
  const o = await login('mavzuna');
  await o.goto(BASE + '/cms/guests');
  await o.click('a:has-text("Марта Каримова")');
  await o.waitForSelector('[aria-label="Бонусы"]');
  check('guest card shows points and history', (await text(o, '[aria-label="Бонусы"]')).includes('оплата бонусами'));
  const b0 = points(MARTA);
  await o.fill('input[aria-label="Бонусы вручную"]', '50');
  await o.fill('input[aria-label="Причина"]', 'Извинение за ожидание');
  await o.click('[aria-label="Бонусы"] button:has-text("Начислить")');
  await o.waitForSelector('text=Извинение за ожидание');
  check('owner adds points by hand', points(MARTA) === b0 + 50);

  await o.goto(BASE + '/cms/loyalty');
  const lp = await text(o, 'main');
  check('loyalty page lists promotions and rules', lp.includes('Осенний уход за кожей') && lp.includes('MJ10') && lp.includes('Серебро'));
  await o.click('button:has-text("Новая акция или промокод")');
  await o.fill('form[aria-label="Акция"] input[name=title]', 'Неделя бровей');
  await o.fill('form[aria-label="Акция"] textarea[name=description]', 'Архитектура бровей со скидкой.');
  await o.fill('form[aria-label="Акция"] input[name=value]', '20');
  await o.click('form[aria-label="Акция"] [role=tab]:has-text("English")');
  await o.fill('form[aria-label="Акция"] input[name=title]', 'Brow week');
  await o.check('form[aria-label="Акция"] label:has-text("Архитектура бровей") input');
  await o.click('button:has-text("Сохранить акцию")');
  await o.waitForSelector('main >> text=Неделя бровей');
  check('owner creates an offer', true);
  await o.screenshot({ path: out + '/cms-loyalty.png', fullPage: true });
  await g.goto(BASE + '/');
  check('new offer on the site', (await text(g, '#akcii')).includes('Неделя бровей'));
  await g.goto(BASE + '/en');
  check('new offer in English', (await text(g, '#akcii')).includes('Brow week'));
  await g.goto(BASE + '/#zapis');
  await g.click('#zapis [role=tab]:has-text("Брови и ресницы")');
  check('new offer in booking', (await text(g, '#zapis button:has-text("Архитектура бровей")')).includes('120 c.'));

  // ── Guest account ─────────────────────────────────────
  const a = await pageOf(await ctxOf());
  await a.goto(BASE + '/kabinet');
  await a.fill('input[name=phone]', '93 501 22 14');
  await a.click('button:has-text("Получить код")');
  await a.waitForSelector('text=Демо-режим');
  await a.fill('input[name=code]', (await a.textContent('div:has-text("Демо-режим") >> b')).trim());
  await a.click('button:has-text("Войти")');
  await a.waitForSelector('text=Здравствуйте');
  const card = await text(a, '[aria-label="Бонусы"]');
  check('account shows points and tier', card.includes(String(points(MARTA))) && card.includes('Уровень'), card.slice(0, 120));
  await a.click('[aria-label="Бонусы"] button');
  check('account shows points history', (await text(a, '[aria-label="Бонусы"]')).includes('Корректировка'));
  await a.screenshot({ path: out + '/kabinet-bonus.png', fullPage: true });

  // ── Bot ───────────────────────────────────────────────
  await o.goto(BASE + '/cms/integrations/telegram');
  await o.waitForSelector('text=/Здравствуйте, Мавзуна/');
  const bot = (sel) => o.locator('[aria-live=polite]').locator(sel);
  await bot('button[data-cb=offers]').last().click();
  await o.waitForSelector('[aria-live=polite] >> text=Акции салона');
  const botText = await text(o, '[aria-live=polite]');
  check('bot lists offers', botText.includes('Осенний уход за кожей') && botText.includes('промокод MJ10') && botText.includes('Неделя бровей'));
  await bot('button[data-cb=bonus]').last().click();
  await o.waitForTimeout(800);
  check('bot answers about points', /бонус|номер/i.test((await text(o, '[aria-live=polite]')).slice(-400)));

  // ── Birthday points (the worker's daily job) ──────────
  // "Today" as the job sees it (this process's clock, like the job's)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe' }).format(new Date());
  sql(`update "Guest" set birthday = '1994${today.slice(4)}' where phone = '${MARTA}'`);
  const bb = points(MARTA);
  const run = () => execSync('npx tsx worker/birthdays.ts', { cwd: new URL('..', import.meta.url).pathname }).toString();
  run();
  run(); // only once a year
  check('birthday points awarded once', points(MARTA) === bb + 100, `${bb} → ${points(MARTA)}`);
  check('birthday greeting queued', Number(sql(`select count(*) from "OutboxMessage" where body ilike '%с днём рождения%'`)) === 1);
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
} finally {
  await b.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exit(1);
