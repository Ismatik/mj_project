// Run against a freshly seeded app:  npm run db:seed && node e2e/01-access.mjs
// BASE_URL (default http://localhost:3000), OUT (screenshots, default e2e-output)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

async function loginAs(login, next = '') {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login${next ? '?next=' + encodeURIComponent(next) : ''}`);
  await p.fill('input[name=login]', login);
  await p.fill('input[name=password]', 'change-me-now');
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10000 });
  return { ctx, p };
}
const navLabels = (p) => p.$$eval('aside nav a', (as) => as.map((a) => a.querySelector('span').textContent));

// 1. Unauthenticated → login
{
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto(`${BASE}/cms/pos`);
  check('guest is sent to login with next', p.url().includes('/login?next=%2Fcms%2Fpos'));
  const r = await p.request.get(`${BASE}/api/cms/search?q=Марта`);
  check('search API refuses anonymous', r.status() === 401);
  await p.fill('input[name=login]', 'mavzuna'); await p.fill('input[name=password]', 'wrong');
  await p.click('button[type=submit]');
  const alert = await p.waitForSelector('form [role=alert]');
  check('wrong password shows error', (await alert.textContent()).includes('Неверный'));
  await p.screenshot({ path: `${out}/login.png` });
  await ctx.close();
}

// 2. Owner
{
  const { ctx, p } = await loginAs('mavzuna', '/cms/pos');
  check('owner lands on requested page', new URL(p.url()).pathname === '/cms/pos');
  check('entry loader shows after login', await p.isVisible('text=Открываем салон…'));
  await p.waitForTimeout(2600);
  check('welcome param removed', !p.url().includes('welcome'));
  check('owner sees 11 pages', (await navLabels(p)).length === 11, (await navLabels(p)).join(', '));
  await p.goto(`${BASE}/cms`); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/dashboard.png`, fullPage: true });

  // search
  await p.fill('input[aria-label="Поиск"]', 'Марта');
  await p.waitForSelector('[role=listbox] [role=option]');
  const opts = await p.$$eval('[role=option] div:first-child', (d) => d.map((x) => x.textContent));
  check('search finds guest and bookings', opts.some((t) => t.includes('Марта Каримова')) && opts.some((t) => t.includes('Балаяж')), opts.slice(0, 4).join(' | '));
  await p.screenshot({ path: `${out}/search.png` });
  await p.keyboard.press('Enter');
  await p.waitForURL(/\/cms\/guests\?guest=/);
  await p.waitForSelector('text=История визитов');
  check('Enter opens the guest', true);
  await p.fill('input[aria-label="Поиск"]', '№1005');
  await p.waitForSelector('[role=option]');
  check('search finds receipt by number', (await p.textContent('[role=option]')).includes('Чек №1005'));
  await p.fill('input[aria-label="Поиск"]', '93 501');
  await p.waitForFunction(() => document.querySelector('[role=option]')?.textContent.includes('Марта'));
  check('search finds guest by phone digits', true);
  await p.keyboard.press('Escape');

  // new booking: new guest, Monday refused, clash refused, then success
  await p.click('button:has-text("+ Новая запись")');
  await p.waitForSelector('select');
  await p.click('button:has-text("+ Новая гостья")');
  await p.fill('dialog label:has-text("Имя и фамилия") input', 'Тахмина Рахимова');
  await p.fill('dialog label:has-text("Телефон") input', '93 777 88 99');
  const lashes = await p.$eval('dialog select', (s) => [...s.options].find((o) => o.text.startsWith('Ламинирование ресниц')).value);
  await p.selectOption('dialog select', lashes);
  // pick a Monday
  const monday = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); });
  await p.fill('dialog input[type=date]', monday);
  await p.fill('dialog input[type=time]', '12:00');
  await p.click('dialog button[type=submit]');
  await p.waitForTimeout(400);
  check('Monday is refused', (await p.textContent('dialog')).includes('По понедельникам'));
  const tuesday = await p.evaluate((m) => { const d = new Date(m + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }, monday);
  await p.fill('dialog input[type=date]', tuesday);
  await p.fill('dialog input[type=time]', '15:00');
  await p.waitForTimeout(500);
  await p.click('dialog button[type=submit]');
  await p.waitForSelector('text=Записали:', { timeout: 8000 });
  check('booking saved with toast', true, (await p.textContent('[aria-live=polite]')).trim());
  await p.waitForTimeout(800);
  // second booking: existing guest (Анна), same master, overlapping time → refused
  await p.click('button:has-text("+ Новая запись")');
  await p.fill('dialog input[placeholder="Имя или телефон"]', 'Анна');
  await p.click('dialog button:has-text("Анна Литвинова")');
  await p.selectOption('dialog select', lashes);
  await p.fill('dialog input[type=date]', tuesday);
  await p.fill('dialog input[type=time]', '15:30');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/booking-busy.png` });
  await p.click('dialog button[type=submit]');
  await p.waitForTimeout(600);
  const txt = await p.textContent('dialog');
  check('clash with the master is refused', txt.includes('Мира: занято 15:00–16:00'), txt.match(/Мира: занято[^)]*\)/)?.[0] ?? '');
  await p.screenshot({ path: `${out}/booking-errors.png` });
  await p.click('dialog button:has-text("Отмена")');
  await p.fill('input[aria-label="Поиск"]', 'Тахмина');
  await p.waitForSelector('[role=option]');
  const t2 = await p.$$eval('[role=option]', (d) => d.map((x) => x.textContent));
  check('new guest and booking are searchable', t2.some((t) => t.includes('Тахмина Рахимова')) && t2.some((t) => t.includes('Ламинирование')));
  await p.keyboard.press('Escape');

  await p.goto(`${BASE}/admin`);
  check('owner can open site admin', new URL(p.url()).pathname === '/admin');
  await p.goto(`${BASE}/cms`);
  await p.click('text=Выйти');
  await p.waitForURL(/\/login/);
  await p.goto(`${BASE}/cms`);
  check('logout ends the session', p.url().includes('/login'));
  await ctx.close();
}

// 3. Reception
{
  const { ctx, p } = await loginAs('reception');
  const labels = await navLabels(p);
  check('reception sees 8 pages, no analytics/settings', labels.length === 8 && !labels.includes('Аналитика') && !labels.includes('Настройки'), labels.join(', '));
  const html = await (await p.request.get(`${BASE}/cms/analytics`)).text();
  check('analytics content never reaches reception', !html.includes('Раздел в работе') && html.includes('NEXT_REDIRECT'));
  await p.goto(`${BASE}/cms/analytics`);
  await p.waitForURL((u) => u.pathname === '/cms', { timeout: 5000 }).catch(() => {});
  check('reception is redirected from analytics', new URL(p.url()).pathname === '/cms');
  await p.goto(`${BASE}/admin`);
  check('reception cannot open site admin', new URL(p.url()).pathname === '/cms');
  await ctx.close();
}

// 4. Master
{
  const { ctx, p } = await loginAs('mira');
  check('master lands on calendar', new URL(p.url()).pathname === '/cms/calendar');
  const labels = await navLabels(p);
  check('master sees calendar, services, staff', labels.join('|') === 'Календарь записей|Меню услуг и цены|Мастера и график', labels.join(', '));
  check('master has no booking button', !(await p.isVisible('button:has-text("+ Новая запись")')));
  const r = await p.request.get(`${BASE}/api/cms/search?q=Марта`);
  const j = await r.json();
  check('master search: no guest book, no receipts, own bookings only', j.guests.length === 0 && j.sales.length === 0 && j.appointments.every((a) => a.sub.includes('Мира')), `${j.appointments.length} bookings`);
  await p.goto(`${BASE}/cms/pos`);
  await p.waitForURL((u) => u.pathname === '/cms/calendar', { timeout: 5000 }).catch(() => {});
  check('master is redirected from POS', new URL(p.url()).pathname === '/cms/calendar');
  await ctx.close();
}

// 5. Content manager
{
  const { ctx, p } = await loginAs('content');
  check('content manager lands on site admin', new URL(p.url()).pathname === '/admin');
  await p.goto(`${BASE}/cms`);
  check('content manager cannot open CMS', new URL(p.url()).pathname === '/admin');
  await p.goto(`${BASE}/styleguide`);
  check('styleguide is owner-only', new URL(p.url()).pathname === '/admin');
  await ctx.close();
}

// 6. Mobile
{
  const { ctx, p } = await loginAs('mavzuna');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `${out}/mobile.png` });
  await p.click('button[aria-label="Меню"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/mobile-menu.png` });
  check('mobile menu opens', await p.isVisible('aside nav'));
  await p.click('aside >> text=Книга гостей');
  await p.waitForURL(/\/cms\/guests/);
  check('mobile menu navigates', true);
  await ctx.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exitCode = 1;
await b.close();
