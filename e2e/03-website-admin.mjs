// Run against a freshly seeded app:  npm run db:seed && node e2e/03-website-admin.mjs
// BASE_URL (default http://localhost:3000), OUT (screenshots, default e2e-output)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const newCtx = (w = 1280, h = 900) => b.newContext({ viewport: { width: w, height: h }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe' });
async function loginAs(login, ctx) {
  ctx ??= await newCtx(1360);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  await p.goto(BASE + '/login');
  await p.fill('input[name=login]', login);
  await p.fill('input[name=password]', 'change-me-now');
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  await p.waitForTimeout(2600);
  return { ctx, p };
}
const siteHtml = async () => (await (await fetch(BASE + '/')).text());
try {
// 1. Visitor
{
  const ctx = await newCtx(); const p = await ctx.newPage();
  p.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  await p.goto(BASE + '/');
  check('intro loader on first visit', await p.isVisible('text=Добро пожаловать'));
  await p.waitForTimeout(3200);
  check('loader gone, hero visible', !(await p.isVisible('text=Добро пожаловать')) && await p.isVisible('h1'));
  check('price list from CMS', (await p.textContent('#uslugi')).includes('Педикюр') && (await p.textContent('#uslugi')).includes('320'));
  // scroll through to trigger reveals, then full screenshot
  for (let y = 0; y < 6000; y += 500) { await p.mouse.wheel(0, 500); await p.waitForTimeout(120); }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/site.png', fullPage: true });
  // "перезвоните мне" request (slot booking itself is covered by the Sprint 5 suite)
  await p.locator('#zapis').scrollIntoViewIfNeeded();
  await p.click('#zapis button:has-text("Не нашли удобное время?")');
  await p.fill('#zapis input[placeholder="Имя"]', 'Тахмина');
  await p.fill('#zapis input[placeholder="Телефон"]', '12');
  await p.click('#zapis button:has-text("Перезвоните мне")');
  await p.waitForSelector('text=Нужно 9 цифр', { timeout: 5000 }); check('bad phone refused', true);
  await p.fill('#zapis input[placeholder="Телефон"]', '93 777 88 99');
  await p.click('#zapis button:has-text("Перезвоните мне")');
  await p.waitForSelector('text=Заявка на звонок принята', { timeout: 8000 });
  check('callback request sent', true);
  // second visit in the same session: no loader
  await p.goto(BASE + '/');
  check('no loader on second visit', !(await p.isVisible('text=Добро пожаловать')));
  await ctx.close();
}
// 2. Reception sees the request
{
  const { ctx, p } = await loginAs('reception');
  await p.goto(BASE + '/cms');
  await p.waitForSelector('text=Кто сегодня в кресле');
  const dash = await p.textContent('main'); check('request on CMS dashboard', dash.includes('Заявки с сайта · 1') && dash.includes('Тахмина'), dash.slice(0, 200));
  check('sidebar counter for new requests', (await p.locator('aside a:has-text("Мой салон сегодня") span').nth(1).textContent()) === '1');
  await p.click('.' + 'x'.slice(1) + 'button:has-text("Позвонили")').catch(() => p.click('button:has-text("Позвонили")'));
  await p.waitForSelector('text=/отмечено «позвонили»/');
  check('request marked "called"', true);
  await ctx.close();
}
// 3. Content manager: hide a price, publish
{
  const { ctx, p } = await loginAs('content');
  check('content manager in site admin', new URL(p.url()).pathname === '/admin');
  await p.screenshot({ path: out + '/admin-texts.png', fullPage: true });
  await p.click('nav button:has-text("Услуги и цены")');
  const row = p.locator('div', { has: p.locator('text="Педикюр"') }).filter({ has: p.locator('button[aria-pressed]') }).last();
  await row.locator('button[aria-pressed]').click();
  check('toggle shows "Скрыто"', (await row.locator('button[aria-pressed]').textContent()).includes('Скрыто'));
  await p.waitForSelector('text=Есть неопубликованные изменения');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/admin-prices.png', fullPage: true });
  check('not yet on the live site', (await siteHtml()).includes('Педикюр'));
  const prev = await ctx.newPage();
  await prev.goto(BASE + '/?preview=1');
  check('draft preview hides it', await prev.isVisible('text=Предпросмотр черновика') && !(await prev.textContent('#uslugi')).includes('Педикюр'));
  await prev.close();

  // hero title + SEO + hide a review + upload a photo
  await p.click('nav button:has-text("Тексты секций")');
  await p.fill('textarea[aria-label="Заголовок"] >> nth=0', 'Красота,\nкоторая остаётся');
  await p.click('nav button:has-text("Отзывы")');
  await p.locator('div', { has: p.locator('text=D I, Душанбе') }).locator('button:has-text("Скрыть")').last().click();
  await p.click('nav button:has-text("SEO")');
  await p.fill('input[class*=input] >> nth=0', 'MJ — салон красоты в Душанбе');
  await p.click('nav button:has-text("Фотографии")');
  await p.locator('input[type=file]').first().setInputFiles(fileURLToPath(new URL('./fixtures/test.png', import.meta.url)));
  await p.waitForSelector('text=/Фото загружено/');
  await p.locator('input[type=file]').nth(1).setInputFiles(fileURLToPath(new URL('./fixtures/fake.png', import.meta.url)));
  await p.waitForSelector('text=Нужен JPG, PNG или WebP');
  check('fake image refused', true);
  await p.screenshot({ path: out + '/admin-photos.png', fullPage: true });
  await p.waitForTimeout(1200);
  await p.click('button:has-text("Опубликовать")');
  await p.waitForSelector('text=✦ Изменения опубликованы на сайте');
  const html = await siteHtml();
  check('hidden price removed from the site after publish', !html.includes('Педикюр'));
  check('new hero title live', html.includes('которая остаётся'));
  check('hidden review gone', !html.includes('Проходил мимо'));
  check('SEO title live', html.includes('<title>MJ — салон красоты в Душанбе</title>'));
  const media = html.match(/\/media\/[a-f0-9-]{36}\.png/);
  check('uploaded photo on the site', !!media);
  if (media) check('photo served', (await fetch(BASE + media[0])).status === 200);
  await ctx.close();
}
// 4. CMS follows the publish; security
{
  const { ctx, p } = await loginAs('mavzuna');
  await p.goto(BASE + '/cms/services');
  const row = p.locator('div', { has: p.locator('text="Педикюр"') }).last();
  check('CMS service no longer "на сайте"', !(await row.textContent()).includes('на сайте'));
  await ctx.close();
  const anon = await fetch(BASE + '/api/admin/upload', { method: 'POST', body: new FormData() });
  check('anonymous upload refused', anon.status === 401);
  const bad = await fetch(BASE + '/media/../../etc/passwd');
  check('media path traversal refused', bad.status === 404);
}
// 5. Mobile
{
  const ctx = await newCtx(390, 844); const p = await ctx.newPage();
  await p.goto(BASE + '/'); await p.waitForTimeout(3300);
  await p.screenshot({ path: out + '/site-mobile.png', fullPage: false });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal scroll on phone', overflow <= 0, String(overflow));
  await ctx.close();
}
} catch (e) { results.push('ERROR ' + e.message.split('\n')[0]); }
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exitCode = 1;
await b.close();
