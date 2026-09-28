// Guest account, masters and portfolio. Run against a freshly seeded app:  npm run db:seed && node e2e/06-guest-account.mjs
// The app must show sign-in codes on screen (development, or DEMO_LOGIN_CODES=1).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const ctxOf = async (w, h) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe' });
  await c.route(/unsplash|mino\.tj/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await c.addInitScript(() => sessionStorage.setItem('mj-intro', '1')); // skip the intro loader
  return c;
};
const pageOf = async (ctx) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  return p;
};
const times = (p, scope) => p.$$eval(`${scope} button`, (bs) => bs.map((x) => x.textContent.trim()).filter((t) => /^\d\d:\d\d$/.test(t)));

async function signIn(p, phone, name) {
  await p.goto(BASE + '/kabinet');
  await p.fill('input[name=phone]', phone);
  await p.click('button:has-text("Получить код")');
  await p.waitForSelector('text=Демо-режим');
  const code = (await p.textContent('div:has-text("Демо-режим") >> b')).trim();
  await p.fill('input[name=code]', code);
  await p.click('button:has-text("Войти")');
  if (name) {
    await p.waitForSelector('input[name=name]');
    await p.fill('input[name=name]', name);
    await p.click('button:has-text("Войти")');
  }
  await p.waitForSelector('text=Здравствуйте');
  return code;
}

try {
  // ── Masters and portfolio ─────────────────────────────
  const desk = await ctxOf(1360, 900);
  const p = await pageOf(desk);
  await p.goto(BASE + '/mastera');
  const cards = await p.$$eval('a[href^="/mastera/"]', (as) => as.map((a) => a.getAttribute('href')));
  check('masters page lists the team', ['/mastera/mavzuna', '/mastera/ines', '/mastera/mira', '/mastera/petra', '/mastera/dario'].every((h) => cards.includes(h)), cards.join(' '));
  await p.waitForTimeout(900);
  await p.screenshot({ path: out + '/masters.png', fullPage: true });

  await p.click('a[href="/mastera/mira"]');
  await p.waitForURL(/\/mastera\/mira$/);
  await p.waitForSelector('h1:has-text("Мира")');
  const bio = await p.textContent('main');
  check('master page: bio and prices', bio.includes('Архитектура бровей') && bio.includes('ламинирование ресниц'));
  await p.click('button[aria-label^="Открыть фото"]');
  await p.waitForSelector('[role=dialog] figcaption:has-text("Свадебный образ")');
  await p.keyboard.press('Escape');
  check('portfolio viewer opens and closes', (await p.$('[role=dialog]')) === null);
  // Booking on the master page offers only her services and only her
  const svc = await p.$$eval('#zapis [role=tab]', (ts) => ts.map((t) => t.textContent));
  check('master booking: only her categories', svc.length > 0 && !svc.includes('Ногти'), svc.join(', '));
  await p.click('#zapis [role=tab]:has-text("Брови и ресницы")');
  await p.click('#zapis button:has-text("Архитектура бровей")');
  const chips = await p.$$eval('#zapis fieldset:nth-of-type(2) button', (bs) => bs.map((x) => x.textContent));
  check('master booking: master fixed', chips.includes('Мира') && chips.length === 2, chips.join(', '));
  await p.screenshot({ path: out + '/master-page.png', fullPage: true });

  await p.goto(BASE + '/portfolio');
  const all = await p.$$('button[aria-label^="Открыть фото"]');
  await p.click('[aria-label="Направление"] button:has-text("Макияж")');
  const makeup = await p.$$('button[aria-label^="Открыть фото"]');
  check('portfolio filter by category', all.length === 2 && makeup.length === 1, `${all.length} → ${makeup.length}`);
  check('unknown master → 404', (await p.goto(BASE + '/mastera/nobody')).status() === 404);

  // ── Guest account: sign in with a code ────────────────
  const phoneCtx = await ctxOf(1360, 900);
  const g = await pageOf(phoneCtx);
  await g.goto(BASE + '/kabinet');
  await g.screenshot({ path: out + '/kabinet-signin.png' });
  await g.fill('input[name=phone]', '90 640 28 16');
  await g.click('button:has-text("Получить код")');
  await g.waitForSelector('text=Демо-режим');
  const code = (await g.textContent('div:has-text("Демо-режим") >> b')).trim();
  check('code sent (mock shows it on screen)', /^\d{4}$/.test(code), code);
  const again = await g.textContent('button:has-text("Отправить код ещё раз")');
  check('resend waits', /через \d+ с/.test(again), again);
  const wrong = code === '0000' ? '1111' : '0000';
  await g.fill('input[name=code]', wrong);
  await g.click('button:has-text("Войти")');
  await g.waitForSelector('[role=alert]:has-text("Неверный код")');
  check('wrong code rejected', (await g.textContent('[role=alert]')).includes('Осталось попыток: 4'));
  await g.fill('input[name=code]', code);
  await g.click('button:has-text("Войти")');
  await g.waitForSelector('text=Здравствуйте, Гульнора');
  const acc = await g.textContent('main');
  check('account: upcoming booking', acc.includes('Окрашивание') && acc.includes('Подтверждена'));
  check('account: visit history with rebook', (await g.$$('a:has-text("Записаться снова")')).length > 3);
  const navName = await g.textContent('nav a[href="/kabinet"]');
  check('nav shows the guest', navName.includes('Гульнора'), navName);
  await g.screenshot({ path: out + '/kabinet-account.png', fullPage: true });

  // Reschedule the upcoming visit
  await g.click('li[aria-label^="Окрашивание"] button:has-text("Перенести")');
  await g.locator('li[aria-label^="Окрашивание"] button[aria-pressed]').nth(3).click();
  await g.waitForFunction(() => [...document.querySelectorAll('li[aria-label^="Окрашивание"] button')].some((x) => /^\d\d:\d\d$/.test(x.textContent.trim())));
  const moveTimes = await times(g, 'li[aria-label^="Окрашивание"]');
  const newTime = moveTimes[1];
  await g.click(`li[aria-label^="Окрашивание"] button:text-is("${newTime}")`);
  await g.waitForSelector(`li[aria-label^="Окрашивание"][aria-label$="${newTime}"]`);
  check('reschedule moves the visit', true, newTime);

  // Favourite master
  await g.click('button:has-text("☆ Инес")');
  await g.waitForSelector('text=★ Инес');
  check('favourite master saved', true);

  // Rebook from history → home with service and master pre-selected, contacts pre-filled
  await g.click('li:has-text("Окрашивание") >> a:has-text("Записаться снова")');
  await g.waitForURL(/service=/);
  await g.waitForSelector('#zapis button[aria-pressed=true]:has-text("Окрашивание")');
  const masterChips = await g.$$eval('#zapis fieldset:nth-of-type(2) button', (bs) => bs.map((x) => `${x.textContent}${x.getAttribute('aria-pressed') === 'true' ? '*' : ''}`));
  check('rebook: service and master pre-selected', masterChips.includes('★ Инес*'), masterChips.join(', '));
  await g.locator('#zapis button:has(small)').nth(4).click();
  await g.waitForFunction(() => [...document.querySelectorAll('#zapis button')].some((x) => /^\d\d:\d\d$/.test(x.textContent)));
  const t = (await times(g, '#zapis'))[0];
  await g.click(`#zapis button:text-is("${t}")`);
  check('contacts pre-filled', (await g.inputValue('input[name=phone]')) === '90 640 28 16' && (await g.inputValue('input[name=name]')).startsWith('Гульнора'));
  await g.click(`#zapis button:has-text("Записаться на ${t}")`);
  await g.waitForSelector('text=Спасибо, Гульнора');
  await g.click('#zapis a:has-text("Мои записи")');
  await g.waitForURL(/kabinet/);
  const rows = await g.$$('li[aria-label^="Окрашивание"]');
  check('new booking appears in the account', rows.length === 2, String(rows.length));

  // Cancel it
  const second = g.locator('li[aria-label^="Окрашивание"]').nth(1);
  await second.locator('button:has-text("Отменить")').click();
  await second.locator('button:has-text("Да, отменить")').click();
  await g.waitForFunction(() => document.querySelectorAll('li[aria-label^="Окрашивание"]').length === 1);
  check('cancel removes the booking', true);

  // Reception sees the changes; owner sees the code in the outbox
  const staffCtx = await ctxOf(1360, 900);
  const o = await pageOf(staffCtx);
  await o.goto(BASE + '/login');
  await o.fill('input[name=login]', 'mavzuna');
  await o.fill('input[name=password]', 'change-me-now');
  await o.click('button[type=submit]');
  await o.waitForURL((u) => !u.pathname.startsWith('/login'));
  await o.goto(BASE + '/cms/integrations');
  const outbox = await o.textContent('main');
  check('outbox: login code, reschedule and cancel alerts', outbox.includes('код для входа') && outbox.includes('перенесла запись') && outbox.includes('отменила запись'));

  // Sign out
  await g.click('button:has-text("Выйти")');
  await g.waitForSelector('button:has-text("Получить код")');
  check('sign out', true);

  // ── A first-time guest on a phone ─────────────────────
  const mob = await ctxOf(390, 844);
  const m = await pageOf(mob);
  await signIn(m, '93 777 12 34', 'Дилором Каримова');
  const empty = await m.textContent('main');
  check('new guest: account created', empty.includes('Здравствуйте, Дилором') && empty.includes('Пока записей нет'));
  await m.screenshot({ path: out + '/kabinet-mobile.png', fullPage: true });
  await m.goto(BASE + '/');
  await m.click('nav summary[aria-label="Меню"]');
  await m.waitForSelector('nav details[open] a[href="/portfolio"]');
  await m.screenshot({ path: out + '/mobile-menu.png' });
  await m.click('nav details[open] a[href="/mastera"]');
  await m.waitForURL(/\/mastera$/);
  check('mobile menu reaches masters', true);
  // Too many codes for one phone
  const lim = await pageOf(await ctxOf(390, 844));
  await lim.goto(BASE + '/kabinet');
  await lim.fill('input[name=phone]', '93 777 12 34');
  await lim.click('button:has-text("Получить код")');
  await lim.waitForSelector('[role=alert]');
  check('resend is throttled per phone', (await lim.textContent('[role=alert]')).includes('Новый можно запросить'));

  // ── Site admin: hide a master, add portfolio work ─────
  await o.goto(BASE + '/admin#masters');
  await o.waitForSelector('section[aria-label="Мастер Дарио"]');
  await o.click('section[aria-label="Мастер Дарио"] button:has-text("На сайте")');
  await o.setInputFiles('input[aria-label="Добавить работы: Петра"]', { name: 'nails.png', mimeType: 'image/png', buffer: png });
  await o.waitForSelector('input[aria-label="Подпись к фото 1: Петра"]');
  await o.fill('input[aria-label="Подпись к фото 1: Петра"]', 'Нюдовый маникюр');
  check('new work defaults to her field', (await o.inputValue('select[aria-label="Направление фото 1: Петра"]')) === 'nails');
  await o.waitForSelector('text=Есть неопубликованные изменения');
  await o.waitForTimeout(1200);
  await o.screenshot({ path: out + '/admin-masters.png', fullPage: false });
  await o.click('button:has-text("Опубликовать")');
  await o.waitForSelector('text=Изменения опубликованы');
  await p.goto(BASE + '/mastera');
  const after = await p.$$eval('a[href^="/mastera/"]', (as) => as.map((a) => a.getAttribute('href')));
  check('hidden master gone from the site', !after.includes('/mastera/dario') && after.includes('/mastera/petra'));
  check('hidden master page → 404', (await p.goto(BASE + '/mastera/dario')).status() === 404);
  await p.goto(BASE + '/portfolio');
  check('new work on the portfolio', (await p.textContent('main')).includes('Нюдовый маникюр'));
  await p.click('[aria-label="Направление"] button:has-text("Ногти")');
  check('new work filed under nails', (await p.$$('button[aria-label^="Открыть фото"]')).length === 1);
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
} finally {
  await b.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exit(1);
