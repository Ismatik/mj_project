// Run against a freshly seeded app:  npm run db:seed && node e2e/04-online-booking.mjs
// BASE_URL (default http://localhost:3000), OUT (screenshots, default e2e-output)
import { chromium } from 'playwright';

import { mkdirSync, readFileSync } from 'node:fs';
const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const ctxOf = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe' }); await c.route(/unsplash|mino\.tj/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png })); return c; };
async function loginAs(login, w = 1360, h = 900) {
  const ctx = await ctxOf(w, h); const p = await ctx.newPage();
  p.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  await p.goto(BASE + '/login'); await p.fill('input[name=login]', login); await p.fill('input[name=password]', 'change-me-now');
  await p.click('button[type=submit]'); await p.waitForURL((u) => !u.pathname.startsWith('/login')); await p.waitForTimeout(2600);
  return { ctx, p };
}
try {
  // Device 1: a guest on her phone books online
  const phone = await ctxOf(390, 844); const g = await phone.newPage();
  g.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  await g.goto(BASE + '/#zapis'); await g.waitForTimeout(3200);
  await g.locator('#zapis').scrollIntoViewIfNeeded();
  await g.click('#zapis [role=tab]:has-text("Брови и ресницы")');
  await g.click('#zapis button:has-text("Ламинирование ресниц")');
  await g.click('#zapis button:has-text("Мира")');
  // choose the second offered day (never today, so the slot is not in the past)
  await g.locator('#zapis button:has(small)').nth(1).click();
  await g.waitForFunction(() => [...document.querySelectorAll('#zapis button')].some((x) => /^\d\d:\d\d$/.test(x.textContent)));
  const times = await g.$$eval('#zapis button', (bs) => bs.map((x) => x.textContent).filter((t) => /^\d\d:\d\d$/.test(t)));
  check('free times offered', times.length > 3, times.slice(0, 6).join(' '));
  const pick = times[2];
  await g.click(`#zapis button:text-is("${pick}")`);
  await g.fill('input[name=name]', 'Малика Рахимова');
  await g.fill('input[name=phone]', '98 555 44 33');
  await g.screenshot({ path: out + '/booking-phone.png', fullPage: false });
  await g.click(`#zapis button:has-text("Записаться на ${pick}")`);
  await g.waitForSelector('text=Спасибо, Малика Рахимова!', { timeout: 10000 });
  const summary = await g.textContent('[role=status]');
  check('guest sees confirmation', summary.includes('Ламинирование ресниц') && summary.includes('Мира'), summary.slice(0, 120));
  await g.screenshot({ path: out + '/booking-done.png' });
  // The same time is gone for the next visitor
  const g2 = await phone.newPage(); await g2.goto(BASE + '/#zapis'); await g2.waitForTimeout(800);
  await g2.click('#zapis [role=tab]:has-text("Брови и ресницы")'); await g2.click('#zapis button:has-text("Ламинирование ресниц")'); await g2.click('#zapis button:has-text("Мира")');
  await g2.locator('#zapis button:has(small)').nth(1).click();
  await g2.waitForTimeout(1200);
  const times2 = await g2.$$eval('#zapis button', (bs) => bs.map((x) => x.textContent).filter((t) => /^\d\d:\d\d$/.test(t)));
  check('booked time disappears for others', !times2.includes(pick) && times2.length > 0);

  // Device 2: reception at the desk
  const { ctx, p } = await loginAs('reception');
  await p.fill('input[aria-label="Поиск"]', 'Малика Рахимова');
  await p.waitForSelector('[role=option]:has-text("Ламинирование")');
  await p.click('[role=option]:has-text("Ламинирование")');
  await p.waitForURL(/calendar/);
  await p.waitForSelector('text=источник: сайт');
  const panel = await p.textContent('section[aria-label="Запись"]');
  check('booking in the CMS calendar on another device', panel.includes(pick) && panel.includes('Мира') && panel.includes('Ожидание'), panel.slice(0, 140));
  await p.screenshot({ path: out + '/calendar-online.png', fullPage: true });
  await p.click('button:has-text("Подтвердить")'); await p.waitForSelector('text=Запись подтверждена');
  check('reception confirms', true);
  await ctx.close();

  // Owner: integrations + outbox
  const o = await loginAs('mavzuna');
  await o.p.goto(BASE + '/cms/integrations');
  const outbox = await o.p.textContent('main');
  check('outbox has reception note and guest confirmation', outbox.includes('Онлайн-запись с сайта') && outbox.includes('вы записаны'));
  await o.p.click('button:has-text("Доставить сейчас")'); await o.p.waitForSelector('text=/Обработано сообщений|Очередь пуста/');
  await o.p.waitForTimeout(600);
  check('mock delivery marks sent', (await o.p.textContent('main')).includes('Отправлено · мок'));
  await o.p.locator('article', { hasText: 'WhatsApp' }).locator('button:has-text("Живой")').click();
  await o.p.waitForSelector('text=/Живое подключение WhatsApp появится в R2/');
  check('live mode refused until connected', true);
  await o.p.locator('article', { hasText: 'Telegram' }).locator('button:has-text("Тест")').click();
  await o.p.waitForSelector('text=Тестовое сообщение в очереди');
  check('test message queued', true);
  await o.p.screenshot({ path: out + '/integrations.png', fullPage: true });
  await o.p.goto(BASE + '/cms/account');
  check('password page for everyone', await o.p.isVisible('text=Мой пароль'));
  await o.ctx.close();
  const m = await loginAs('mira');
  await m.p.goto(BASE + '/cms/account');
  check('master can open password page', await m.p.isVisible('text=Мой пароль'));
  await m.p.goto(BASE + '/cms/integrations'); await m.p.waitForURL((u) => u.pathname === '/cms/calendar', { timeout: 5000 }).catch(() => {});
  check('master cannot open integrations', new URL(m.p.url()).pathname === '/cms/calendar');
  await m.ctx.close();
} catch (e) { results.push('ERROR ' + e.message.split('\n')[0]); }
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exitCode = 1;
await b.close();
