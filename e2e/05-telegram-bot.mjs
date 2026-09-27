// Run against a freshly seeded app:  npm run db:seed && node e2e/05-telegram-bot.mjs
// BASE_URL (default http://localhost:3000), OUT (screenshots, default e2e-output)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

async function loginAs(login) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe' });
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

try {
  const { ctx, p } = await loginAs('mavzuna');
  await p.goto(BASE + '/cms/integrations');
  const code = (await p.textContent('code')).replace('/staff ', '').trim();
  check('staff code shown on integrations', /^MJ-\d{4}$/.test(code), code);

  // Live mode needs keys
  await p.locator('article', { hasText: 'Telegram' }).locator('button:has-text("Живой")').click();
  await p.waitForSelector('text=/Сначала добавьте TELEGRAM_BOT_TOKEN/');
  check('live mode refused without keys', true);

  await p.goto(BASE + '/cms/integrations/telegram');
  await p.waitForSelector('text=/Здравствуйте, Мавзуна!/');
  check('bot greets in the simulator', true);
  const bot = (sel) => p.locator('[aria-live=polite]').locator(sel);
  // Press a bot button and wait until the bot's reply containing `expect` has arrived
  const press = async (text, expect) => {
    const before = await p.locator('[aria-live=polite] > div').count();
    await bot(`button:has-text("${text}")`).last().click();
    try {
      await p.waitForFunction(
        ([e, n]) => {
          const all = document.querySelectorAll('[aria-live=polite] > div');
          return all.length > n && all[all.length - 1].textContent.match(new RegExp(e));
        },
        [expect, before],
        { timeout: 10000 },
      );
    } catch {
      const last = await p.locator('[aria-live=polite] > div').last().textContent();
      throw new Error(`after "${text}" expected /${expect}/, got: ${last.slice(0, 160)}`);
    }
  };
  await press('✦ Записаться', 'Что будем делать');
  await press('Брови и ресницы', 'Ламинирование');
  await press('Ламинирование ресниц', 'Любой мастер');
  await press('Мира', 'Выберите день');
  // second offered day
  const dayButtons = bot('button:text-matches("^(Вт|Ср|Чт|Пт|Сб|Вс) ")');
  const day = await dayButtons.nth(1).textContent();
  await press(day, 'Свободное время|свободного времени нет');
  const times = await bot('button').filter({ hasText: /^\d\d:\d\d$/ }).allTextContents();
  check('free times offered in the bot', times.length > 3, times.slice(0, 5).join(' '));
  await press(times[1], 'Поделитесь');
  check('bot asks for the phone', await p.isVisible('text=Поделитесь, пожалуйста, номером'));
  await p.fill('input[aria-label="Номер, которым поделиться"]', '+992 93 222 33 44');
  await p.click('button:has-text("📱 Поделиться номером")');
  await p.waitForSelector('text=Проверьте, пожалуйста', { timeout: 10000 });
  check('confirmation screen', await p.isVisible('text=Проверьте, пожалуйста'));
  await press('✓ Записаться', 'Вы записаны');
  check('booked in the bot', await p.isVisible('text=Вы записаны ✦'));
  await p.screenshot({ path: out + '/bot-booked.png', fullPage: true });

  // The booking is in the CMS calendar, source Telegram
  const cms = await ctx.newPage();
  await cms.goto(BASE + '/cms/integrations');
  const outbox = await cms.textContent('main');
  check('reception notified via outbox', outbox.includes('Онлайн-запись с Telegram'));
  await cms.fill('input[aria-label="Поиск"]', 'Мавзуна');
  await cms.waitForSelector('[role=option]:has-text("Ламинирование")');
  await cms.click('[role=option]:has-text("Ламинирование")');
  await cms.waitForSelector('text=источник: Telegram');
  check('booking in the calendar, source Telegram', (await cms.textContent('section[aria-label="Запись"]')).includes(times[1]));
  await cms.close();

  // My bookings → reschedule → cancel
  await press('Мои записи', 'Что-нибудь ещё');
  await press('Перенести', 'Выберите новый день');
  // Try days until one has free time (the master may be off on some days)
  for (let i = 2; i < 8; i++) {
    const d = await p.locator('[aria-live=polite] > div').last().locator('button').nth(i).textContent();
    await press(d, 'Свободное время|Другие дни');
    if ((await p.locator('[aria-live=polite] > div').last().textContent()).startsWith('Свободное время')) break;
  }
  const t2 = await p.locator('[aria-live=polite] > div').last().locator('button').filter({ hasText: /^\d\d:\d\d$/ }).allTextContents();
  await p.locator('[aria-live=polite] > div').last().locator(`button:text-is("${t2[0]}")`).click();
  await p.waitForSelector('text=Перенесли ✦', { timeout: 10000 });
  check('rescheduled in the bot', await p.isVisible('text=Перенесли ✦'));
  await press('Мои записи', 'Что-нибудь ещё');
  await press('Отменить', 'Точно отменить');
  await press('Да, отменить', 'Запись отменена');
  check('cancelled in the bot', await p.isVisible('text=Запись отменена'));

  // Staff chat
  await p.fill('input[aria-label="Сообщение боту"]', `/staff ${code}`);
  await p.click('form:has(input[aria-label="Сообщение боту"]) button[type=submit]');
  await p.waitForSelector('text=/получать уведомления ресепшена/', { timeout: 10000 });
  check('staff chat linked with the code', await p.isVisible('text=/получать уведомления ресепшена/'));
  await p.screenshot({ path: out + '/bot-simulator.png', fullPage: true });
  await ctx.close();

  // Webhook refuses requests without the secret
  const hook = await fetch(BASE + '/api/telegram/webhook', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  check('webhook refuses unsigned requests', hook.status === 401);

  // Reception cannot open the simulator
  const r = await loginAs('reception');
  await r.p.goto(BASE + '/cms/integrations/telegram');
  await r.p.waitForURL((u) => u.pathname === '/cms', { timeout: 5000 }).catch(() => {});
  check('simulator is owner-only', new URL(r.p.url()).pathname === '/cms');
  await r.ctx.close();
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exitCode = 1;
await b.close();
