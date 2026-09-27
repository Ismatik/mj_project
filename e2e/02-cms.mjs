// Run against a freshly seeded app:  npm run db:seed && node e2e/02-cms.mjs
// BASE_URL (default http://localhost:3000), OUT (screenshots, default e2e-output)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const num = (t) => Number(t.replace(/[^\d]/g, ''));
async function loginAs(login) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  await p.goto(BASE + '/login');
  await p.fill('input[name=login]', login);
  await p.fill('input[name=password]', 'change-me-now');
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  await p.waitForTimeout(2700);
  return { ctx, p };
}
const statValue = async (p, label) => {
  await p.waitForTimeout(2200);
  const card = p.locator('div', { has: p.locator(`text="${label}"`) }).filter({ hasText: 'c.' }).last();
  return num(await card.locator('div').nth(1).textContent());
};
try {
{
  const { ctx, p } = await loginAs('mavzuna');
  await p.goto(BASE + '/cms'); 
  const before = await statValue(p, 'Сегодня');
  await p.screenshot({ path: out + '/dashboard.png', fullPage: true });
  check('dashboard shows categories, chart, reminders', await p.isVisible('text=Что любят гостьи') && await p.isVisible('text=Маленькие напоминания') && await p.isVisible('text=Выручка ·'));

  // POS: two menu items, pay by card
  await p.goto(BASE + '/cms/pos');
  await p.click('button:has-text("Маникюр, гель-лак")');
  await p.click('button:has-text("Архитектура бровей")');
  const total = num(await p.textContent('text=Итого >> xpath=following-sibling::span'));
  check('check total adds up', total === 430, String(total));
  await p.screenshot({ path: out + '/pos.png', fullPage: true });
  await p.click('button:has-text("Карта")');
  check('payment loader shown', await p.isVisible('text=Проводим оплату · Карта'));
  await p.waitForSelector('text=/Оплата 430 c. принята · Карта/', { timeout: 10000 });
  check('payment toast', true);
  await p.waitForSelector('text=Чек пока пуст');
  await p.waitForSelector('text=Маникюр, гель-лак, Архитектура бровей', { timeout: 8000 }); check('receipt appears in today list', true);
  await p.goto(BASE + '/cms');
  const after = await statValue(p, 'Сегодня');
  check('POS sale appears on the dashboard', after - before === 430, `${before} → ${after}`);

  // pay a booking: dashboard row -> calendar panel -> POS
  await p.click('a:has-text("Лейла Х.")');
  await p.waitForSelector('text=Оплатить в кассе');
  await p.screenshot({ path: out + '/calendar.png', fullPage: true });
  await p.click('text=Оплатить в кассе');
  await p.waitForURL(/pos\?appt=/);
  await p.waitForSelector('text=по записи'); check('booking loaded into the check', true);
  await p.click('button:has-text("Наличные")');
  await p.waitForSelector('text=/Оплата 950 c. принята/', { timeout: 10000 });
  await p.goto(BASE + '/cms');
  await p.waitForTimeout(800);
  const leilaTag = await p.locator('a:has-text("Лейла Х.")').textContent();
  check('paid booking becomes "Готово"', leilaTag.includes('Готово'));

  // calendar: move a booking + mark in chair
  await p.goto(BASE + '/cms/calendar');
  const card = p.locator('a:has-text("Юки")').first();
  await card.click();
  await p.waitForSelector('text=Перенести');
  await p.click('button:has-text("В кресле")');
  await p.waitForSelector('text=/Юки Таирова в кресле/');
  check('status change from calendar', true);

  // guests: open card, edit note
  await p.goto(BASE + '/cms/guests');
  check('guest table shows visit counts', num(await p.locator('a:has-text("Марта Каримова") span').nth(3).textContent()) >= 20);
  await p.click('a:has-text("Марта Каримова")');
  await p.waitForSelector('text=История визитов');
  await p.click('text=Изменить карточку');
  await p.fill('textarea', 'Аллергия на аммиак. Любит чай с мятой.');
  await p.click('button:has-text("Сохранить")');
  await p.waitForSelector('text=Аллергия на аммиак');
  check('guest notes saved', true);
  await p.screenshot({ path: out + '/guests.png', fullPage: true });
  await p.click('a[href="/cms/guests?tag=VIP"]'); await p.waitForURL(/tag=VIP/); await p.waitForTimeout(400);
  const vipRows = await p.locator('a[href*="guest="]').count();
  check('VIP filter', vipRows === 2, String(vipRows));

  // services: change price, POS menu follows
  await p.goto(BASE + '/cms/services');
  const row = p.locator('div', { hasText: /^Педикюр/ }).last();
  await row.hover();
  await row.locator('button:has-text("Изменить")').click();
  const priceInput = p.locator('label:has-text("Цена") input');
  await priceInput.fill('350');
  await p.click('button:has-text("Сохранить")');
  await p.waitForSelector('text=Сохранено: Педикюр');
  await p.screenshot({ path: out + '/services.png', fullPage: true });
  await p.goto(BASE + '/cms/pos');
  check('new price reaches POS menu', (await p.locator('button:has-text("Педикюр")').textContent()).includes('350'));

  // rental: book a dress
  await p.goto(BASE + '/cms/rental');
  const lola = p.locator('article', { hasText: 'Платье «Лола»' });
  await lola.locator('button:has-text("Забронировать")').click();
  const d = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await lola.locator('input[type=date]').fill(d);
  await lola.locator('input[inputmode=numeric]').fill('2');
  await lola.locator('button:has-text("Забронировать")').click();
  await p.waitForSelector('text=/Платье «Лола»: бронь/');
  check('dress booked', await lola.locator('text=/Бронь/').isVisible());
  await lola.locator('button:has-text("Забронировать")').click();
  await lola.locator('input[type=date]').fill(d);
  await lola.locator('button:has-text("Забронировать")').last().click();
  await p.waitForSelector('text=/Уже забронировано/');
  check('double dress booking refused', true);
  await p.screenshot({ path: out + '/rental.png', fullPage: true });

  // staff: toggle a day
  await p.goto(BASE + '/cms/staff');
  await p.locator('[aria-label="График: Дарио"] button').nth(1).click();
  await p.waitForSelector('text=/Дарио: Вт — рабочий день/');
  check('work day toggled', true);
  await p.screenshot({ path: out + '/staff.png', fullPage: true });

  await p.goto(BASE + '/cms/analytics');
  await p.waitForTimeout(1500);
  check('analytics renders', await p.isVisible('text=Пиковые часы') && await p.isVisible('text=Топ услуг месяца'));
  await p.screenshot({ path: out + '/analytics.png', fullPage: true });

  await p.goto(BASE + '/cms/settings');
  await p.fill('input[value="Студия на Бухоро"]', 'Студия на Бухоро, 23/25');
  await p.click('button:has-text("Сохранить")');
  await p.waitForSelector('text=✦ Сохранено');
  await p.waitForTimeout(800);
  check('branch in header updated', await p.isVisible('header >> text=Студия на Бухоро, 23/25'));
  await p.screenshot({ path: out + '/settings.png', fullPage: true });
  await ctx.close();
}
{
  const { ctx, p } = await loginAs('reception');
  await p.goto(BASE + '/cms/services');
  check('reception cannot edit prices', (await p.locator('button:has-text("Изменить")').count()) === 0);
  await p.goto(BASE + '/cms/staff');
  check('reception cannot change schedule', (await p.locator('[aria-label^="График"] button').count()) === 0);
  await ctx.close();
}
{
  const { ctx, p } = await loginAs('mira');
  const staffNames = await p.$$eval('a[href*="appt="] div:last-child', (d) => d.map((x) => x.textContent));
  check('master sees only own bookings', staffNames.length > 0 && staffNames.every((t) => t.includes('Мира')), staffNames.length + ' cards');
  await p.goto(BASE + '/cms/staff');
  check('master does not see revenue', !(await p.isVisible('text=Выручка в')));
  await ctx.close();
}
} catch (e) { results.push('ERROR ' + e.message.split('\n')[0]); }
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exitCode = 1;
await b.close();
