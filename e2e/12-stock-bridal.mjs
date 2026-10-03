// Stock (delivery in packs, waste, stocktake, norms per service, write-off at the till, low-stock alert)
// and the bridal package builder (discount, dress availability, trial look with prepayment, CMS list).
// Run against a freshly seeded app:  npm run db:seed && node e2e/12-stock-bridal.mjs  (needs DATABASE_URL)
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const text = async (p, sel) => ((await p.textContent(sel)) ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ');
const sql = (q) => execSync(`psql "${process.env.DATABASE_URL}" -tAc ${JSON.stringify(q)}`).toString().trim();
const qtyOf = (name) => Number(sql(`select quantity from "StockItem" where name = '${name}'`));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe' }).format(new Date());
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' - ' + extra : ''}`);
const ctxOf = async () => {
  const c = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe', extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.12' } });
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
  // ── Stock ─────────────────────────────────────────────
  const o = await login('mavzuna');
  await o.goto(BASE + '/cms/stock?show=low');
  const low = await text(o, 'section[aria-labelledby="items"]');
  check('low stock listed', low.includes('Осветлитель Blondor') && low.includes('розовое золото') && !low.includes('Перчатки'));
  await o.goto(BASE + '/cms/stock');
  const row = (name) => `tr[data-item="${name}"]`;
  await o.click(`${row('Осветлитель Blondor')} button:has-text("Приход")`);
  await o.fill(`${row('Осветлитель Blondor')} input[aria-label="Количество"]`, '1');
  await o.selectOption(`${row('Осветлитель Blondor')} select[aria-label="Единица прихода"]`, 'packs');
  await o.fill(`${row('Осветлитель Blondor')} input[aria-label="Комментарий"]`, 'Накладная 118');
  await o.click(`${row('Осветлитель Blondor')} form button[type=submit]`);
  await o.waitForSelector(`${row('Осветлитель Blondor')} >> text=750 г`);
  check('delivery in packs', qtyOf('Осветлитель Blondor') === 750);
  await o.click(`${row('Перчатки нитриловые')} button:has-text("Списать")`);
  await o.fill(`${row('Перчатки нитриловые')} input[aria-label="Количество"]`, '10');
  await o.fill(`${row('Перчатки нитриловые')} input[aria-label="Комментарий"]`, 'Порвались');
  await o.click(`${row('Перчатки нитриловые')} form button[type=submit]`);
  await o.waitForSelector(`${row('Перчатки нитриловые')} >> text=330 шт`);
  await o.click(`${row('База для гель-лака')} button:has-text("Пересчёт")`);
  await o.fill(`${row('База для гель-лака')} input[aria-label="Количество"]`, '55');
  await o.click(`${row('База для гель-лака')} form button[type=submit]`);
  await o.waitForSelector(`${row('База для гель-лака')} >> text=55 мл`);
  check('waste and stocktake', qtyOf('Перчатки нитриловые') === 330 && qtyOf('База для гель-лака') === 55 && sql(`select delta from "StockMove" m join "StockItem" i on i.id = m."itemId" where i.name = 'База для гель-лака' and m.kind = 'COUNT' order by m."createdAt" desc limit 1`) === '-5');

  await o.fill('form[aria-label="Новая позиция"] input[name=name]', 'Шампунь восстанавливающий');
  await o.selectOption('form[aria-label="Новая позиция"] select[name=unit]', 'мл');
  await o.fill('form[aria-label="Новая позиция"] input[name=packSize]', '1000');
  await o.fill('form[aria-label="Новая позиция"] input[name=packPrice]', '250');
  await o.fill('form[aria-label="Новая позиция"] input[name=minQuantity]', '500');
  await o.fill('form[aria-label="Новая позиция"] input[name=quantity]', '600');
  await o.click('button:has-text("Добавить позицию")');
  await o.waitForSelector(row('Шампунь восстанавливающий'));
  check('new item with opening stock', qtyOf('Шампунь восстанавливающий') === 600);

  await o.selectOption('select[name=normService]', { label: 'Стрижка + укладка' });
  await o.click('button:has-text("+ позиция")');
  await o.selectOption('[aria-label="Расход на услуги"] select[aria-label="Позиция"]', { label: 'Шампунь восстанавливающий' });
  await o.fill('[aria-label="Расход на услуги"] input[aria-label="Расход"]', '30');
  await o.click('button:has-text("Сохранить расход")');
  await o.waitForSelector('text=Расход сохранён');
  check('norm for a service', sql(`select amount from "ServiceConsumption" c join "Service" s on s.id = c."serviceId" where s.name = 'Стрижка + укладка'`) === '30');
  await o.screenshot({ path: out + '/stock.png', fullPage: true });

  // The till writes consumables off; crossing the minimum alerts reception
  const r = await login('reception');
  await r.goto(BASE + '/cms/pos');
  for (let i = 0; i < 5; i++) await r.click('button:has-text("Окрашивание в один тон")');
  await r.click('button:has-text("Стрижка + укладка")');
  await r.click('button:has-text("Карта")');
  await r.waitForSelector('text=/Оплата .* принята/', { timeout: 10000 });
  check('written off at payment', qtyOf('Краситель Igora Royal 6-0') === 120 && qtyOf('Шампунь восстанавливающий') === 570 && qtyOf('Перчатки нитриловые') === 320, `${qtyOf('Краситель Igora Royal 6-0')}/${qtyOf('Шампунь восстанавливающий')}/${qtyOf('Перчатки нитриловые')}`);
  check('moves carry the receipt', Number(sql(`select count(*) from "StockMove" where kind = 'SERVICE' and "saleId" is not null`)) === 4);
  check('low-stock alert once', Number(sql(`select count(*) from "OutboxMessage" where body like 'Заканчивается на складе: Краситель Igora%'`)) === 1);
  await r.goto(BASE + '/cms/stock');
  check('reception sees the stock', (await text(r, 'main')).includes('чек №'));
  const m = await login('mira');
  await m.goto(BASE + '/cms/stock');
  await m.waitForURL((u) => u.pathname !== '/cms/stock', { timeout: 5000 }).catch(() => {});
  check('masters have no stock page', new URL(m.url()).pathname !== '/cms/stock');

  // ── Bridal package ────────────────────────────────────
  const g = await pageOf(await ctxOf());
  await g.goto(BASE + '/');
  const href = await g.getAttribute('#nevesta a:has-text("Собрать свадебный пакет")', 'href');
  check('bridal builder linked from the site', href === '/svadba');
  // A date when "Ситора" is already rented for Farzona
  const busyDay = sql(`select to_char("startsOn", 'YYYY-MM-DD') from "DressBooking" b join "Dress" d on d.id = b."dressId" where d.name like '%Ситора%'`);
  await g.goto(BASE + '/svadba');
  await g.fill('input[name=wedding]', busyDay);
  await g.waitForSelector('button:has-text("Ситора"):has-text("занято")');
  check('dress taken on that date', await g.isDisabled('button:has-text("Ситора")'));
  const wedding = addDays(today, 20);
  await g.fill('input[name=wedding]', wedding);
  await g.waitForFunction(() => !document.querySelector('button[disabled]:has(span)')?.textContent?.includes('Амира'));
  for (const sv of ['Свадебная причёска', 'Свадебный образ под ключ', 'Маникюр, гель-лак']) await g.click(`button:has-text("${sv}")`);
  await g.click('button:has-text("Платье «Амира»")');
  const sum = await text(g, 'aside');
  check('package price with discount and dress', sum.includes('Скидка 10%') && sum.includes('−233 c.') && (await text(g, '[data-testid=total]')) === '3 897 c.', sum.slice(-120));
  await g.check('input[name=trial]');
  await g.locator('fieldset:has-text("Пробный образ") button:has(small)').nth(3).click();
  await g.waitForSelector('fieldset:has-text("Пробный образ") [aria-label="Пробный образ"] button');
  const trialTime = (await g.textContent('fieldset:has-text("Пробный образ") [aria-label="Пробный образ"] button')).trim();
  await g.click(`fieldset:has-text("Пробный образ") [aria-label="Пробный образ"] button:text-is("${trialTime}")`);
  await g.fill('input[name=name]', 'Мадина Шарипова');
  await g.fill('input[name=phone]', '93 888 20 01');
  await g.fill('textarea[name=note]', 'Хочу естественный макияж');
  await g.screenshot({ path: out + '/svadba.png', fullPage: true });
  await g.click('button:has-text("Отправить пакет")');
  await g.waitForSelector('text=/Пакет №\\d+ отправлен/');
  const done = await text(g, '[role=status]');
  check('package sent with the trial booked', done.includes('Пробный образ:') && done.includes('Внести предоплату 290 c.'), done.slice(0, 200));
  const pkg = sql(`select p.total || '/' || p."discountPercent" || '/' || (select count(*) from "DressBooking" b where b."bridalPackageId" = p.id) || '/' || g.tag from "BridalPackage" p join "Guest" g on g.id = p."guestId" where p.name = 'Мадина Шарипова'`);
  check('package, dress booking and bride saved', pkg === '3897/10/1/BRIDE', pkg);
  check('trial is an online booking with a prepayment', sql(`select a.status || '/' || a."depositRequired" from "BridalPackage" p join "Appointment" a on a.id = p."trialAppointmentId" where p.name = 'Мадина Шарипова'`) === 'PENDING/290');
  check('reception told', Number(sql(`select count(*) from "OutboxMessage" where body like 'Свадебный пакет №%Мадина Шарипова%'`)) === 1);

  await g.goto(BASE + '/svadba');
  await g.fill('input[name=wedding]', wedding);
  await g.waitForSelector('button:has-text("Амира"):has-text("занято")');
  check('the dress is now taken for that date', await g.isDisabled('button:has-text("Амира")'));
  await g.goto(BASE + '/en/svadba');
  check('builder in English', (await text(g, 'main')).includes('Build your bridal look'));

  // CMS
  await r.goto(BASE + '/cms/bridal');
  const list = await text(r, 'main');
  check('packages in the CMS', list.includes('Мадина Шарипова') && list.includes('ждёт предоплату') && list.includes('Фарзона Икромова'));
  const num = sql(`select number from "BridalPackage" where name = 'Мадина Шарипова'`);
  await r.click(`tr[data-package="${num}"] button:has-text("Подтвердить")`);
  await r.waitForSelector(`tr[data-package="${num}"] >> text=Подтверждён`);
  r.once('dialog', (d) => d.accept());
  await r.click(`tr[data-package="${num}"] button:has-text("Отменить")`);
  await r.waitForSelector(`tr[data-package="${num}"] >> text=Отменён`);
  check('cancelled package frees the dress', sql(`select count(*) from "DressBooking" b join "BridalPackage" p on p.id = b."bridalPackageId" where p.number = ${num}`) === '0');
  await r.screenshot({ path: out + '/bridal-cms.png', fullPage: true });
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
} finally {
  await b.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exit(1);
