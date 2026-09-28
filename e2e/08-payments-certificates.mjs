// Prepayments, the test checkout, gift certificates (website, till, PDF, balance page) and paying with a certificate.
// Run against a freshly seeded app:  npm run db:seed && node e2e/08-payments-certificates.mjs  (needs DATABASE_URL for one check)
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
/** Amounts are printed with non-breaking spaces */
const text = async (p, sel) => ((await p.textContent(sel)) ?? '').replace(/\u00a0/g, ' ');
const sql = (q) => execSync(`psql "${process.env.DATABASE_URL}" -tAc ${JSON.stringify(q)}`).toString().trim();

const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const ctxOf = async (w = 1360, h = 900) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe', acceptDownloads: true });
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
const pdfOk = async (url) => {
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  return r.status === 200 && r.headers.get('content-type') === 'application/pdf' && buf.subarray(0, 5).toString() === '%PDF-' && buf.length > 10000;
};

try {
  // ── A certificate bought on the website ───────────────
  const g = await pageOf(await ctxOf());
  await g.goto(BASE + '/');
  await g.click('a:has-text("Выбрать сертификат")');
  await g.waitForURL(/\/podarok$/);
  await g.click('[aria-label="Сумма"] button:has-text("2 000")');
  await g.fill('input[name=recipient]', 'Нигора');
  await g.fill('textarea[name=message]', 'С днём рождения!');
  await g.fill('input[name=name]', 'Анна Каримова');
  await g.fill('input[name=phone]', '93 111 22 33');
  await g.screenshot({ path: out + '/gift-form.png', fullPage: true });
  await g.click('button:has-text("Оплатить 2 000")');
  await g.waitForURL(/\/oplata\//);
  check('test checkout shown', (await text(g, 'main')).includes('Тестовая оплата') && (await text(g, 'main h1')).includes('2 000'));
  await g.screenshot({ path: out + '/checkout.png' });
  await g.click('button:has-text("Оплатить 2 000")');
  await g.waitForSelector('text=Оплата прошла');
  const pdfHref = await g.getAttribute('a:has-text("Скачать PDF")', 'href');
  check('certificate PDF', await pdfOk(BASE + pdfHref), pdfHref);
  await g.click('a:has-text("Открыть сертификат")');
  await g.waitForURL(/\/sertifikat\//);
  const certText = await text(g, 'main');
  const code = certText.match(/MJ-[A-Z2-9]{4}-[A-Z2-9]{4}/)?.[0];
  check('certificate page with balance and code', certText.includes('2 000') && certText.includes('Нигора') && !!code, code);
  await g.screenshot({ path: out + '/certificate.png', fullPage: true });

  // English purchase abandoned
  await g.goto(BASE + '/en/podarok');
  await g.fill('input[name=custom]', '750');
  await g.fill('input[name=recipient]', 'Kate');
  await g.fill('input[name=name]', 'John Doe');
  await g.fill('input[name=phone]', '93 222 33 44');
  await g.click('button:has-text("Pay 750 TJS")');
  await g.waitForURL(/\/en\/oplata\//);
  await g.click('button:has-text("Cancel")');
  await g.waitForSelector('text=Payment cancelled');
  check('cancelled payment', true);
  // Tajik certificate PDF (Tajik letters need the fallback font)
  await g.goto(BASE + '/tj/podarok');
  await g.fill('input[name=recipient]', 'Ҷамила');
  await g.fill('input[name=name]', 'Ҳусниддин');
  await g.fill('input[name=phone]', '93 333 44 55');
  await g.click('form button[type=submit]');
  await g.waitForURL(/\/tj\/oplata\//);
  await g.click('main button >> nth=0');
  await g.waitForSelector('text=Пардохт анҷом ёфт');
  check('Tajik certificate PDF', await pdfOk(BASE + (await g.getAttribute('main a[href^="/api/gift/"]', 'href'))));

  // ── Online booking with a prepayment ──────────────────
  await g.goto(BASE + '/#zapis');
  await g.click('#zapis [role=tab]:has-text("Макияж и образы")');
  await g.click('#zapis button:has-text("Свадебный образ под ключ")');
  await g.locator('#zapis button:has(small)').nth(4).click();
  await g.waitForFunction(() => [...document.querySelectorAll('#zapis button')].some((x) => /^\d\d:\d\d$/.test(x.textContent.trim())));
  const t = await g.$$eval('#zapis button', (bs) => bs.map((x) => x.textContent.trim()).find((x) => /^\d\d:\d\d$/.test(x)));
  await g.click(`#zapis button:text-is("${t}")`);
  await g.fill('input[name=name]', 'Малика Турсунова');
  await g.fill('input[name=phone]', '93 444 55 66');
  await g.click(`#zapis button:has-text("Записаться на ${t}")`);
  await g.waitForSelector('text=нужна предоплата 450 c.');
  check('prepayment asked after booking', true);
  await g.click('a:has-text("Внести предоплату 450 c.")');
  await g.waitForURL(/\/oplata\//);
  check('checkout shows the hold time', (await g.textContent('main')).includes('держим для вас запись'));
  await g.click('button:has-text("Оплатить 450")');
  await g.waitForSelector('text=Предоплата внесена');
  check('prepayment paid', true);

  // A second prepayment booking that is never paid: its time is released
  await g.goto(BASE + '/#zapis');
  await g.click('#zapis [role=tab]:has-text("Макияж и образы")');
  await g.click('#zapis button:has-text("Свадебный образ под ключ")');
  await g.locator('#zapis button:has(small)').nth(4).click();
  await g.waitForFunction(() => [...document.querySelectorAll('#zapis button')].some((x) => /^\d\d:\d\d$/.test(x.textContent.trim())));
  const t2 = await g.$$eval('#zapis button', (bs) => bs.map((x) => x.textContent.trim()).find((x) => /^\d\d:\d\d$/.test(x)));
  await g.click(`#zapis button:text-is("${t2}")`);
  await g.fill('input[name=name]', 'Зарина Ахмедова');
  await g.fill('input[name=phone]', '93 555 66 77');
  await g.click(`#zapis button:has-text("Записаться на ${t2}")`);
  await g.waitForSelector('text=нужна предоплата');
  sql(`update "Payment" set "expiresAt" = now() - interval '1 minute' where status = 'PENDING' and purpose = 'DEPOSIT'`);

  // ── Owner: outbox, release, certificates page ─────────
  const o = await login('mavzuna');
  await o.goto(BASE + '/cms/integrations');
  await o.click('button:has-text("Доставить сейчас")');
  await o.waitForSelector('text=Обработано сообщений');
  await o.reload();
  const box = await o.textContent('main');
  check('reception told about the paid prepayment', box.includes('Предоплата 450 c. получена'));
  check('unpaid booking released', box.includes('Запись снята — предоплата не внесена: Зарина Ахмедова'));
  check('confirmation sent after the prepayment', box.includes('Малика, вы записаны'));
  check('online certificate sale reported', box.includes('Продан сертификат на сайте') && box.includes('Нигора'));

  await o.goto(BASE + '/cms/certificates');
  await o.click('[aria-label="Сумма"] button:has-text("500")');
  await o.fill('input[name=recipient]', 'Севара');
  await o.fill('input[name=buyer]', 'Мама Севары');
  await o.click('[aria-label="Оплата"] button:has-text("Наличные")');
  await o.click('button:has-text("Продать за 500")');
  await o.waitForSelector('[role=status] >> text=/MJ-/');
  const tillCode = (await o.textContent('[role=status] div')).trim();
  check('certificate sold at the till', /^MJ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(tillCode), tillCode);
  await o.reload();
  const certs = await o.textContent('main');
  check('certificates list and online payments', certs.includes(tillCode) && certs.includes(code) && certs.includes('Предоплата') && certs.includes('Отменено'));
  await o.screenshot({ path: out + '/cms-certificates.png', fullPage: true });

  // ── Till: prepayment in the receipt, paying with certificates ─
  const r = await login('reception');
  await r.goto(BASE + '/cms/pos');
  await r.click('button:has-text("Лейла Х.")');
  const check1 = await r.textContent('#check');
  check('prepayment shown in the receipt', check1.includes('предоплата онлайн 290 c.') && check1.includes('К оплате') && check1.includes('660 c.'), check1.replace(/\s+/g, ' ').slice(-120));
  await r.click('button:has-text("Карта")');
  await r.waitForSelector('text=/Оплата 660 c. принята/', { timeout: 10000 });
  check('receipt paid with prepayment counted', true);

  await r.goto(BASE + '/cms/pos');
  await r.click('button:has-text("Стрижка + укладка")');
  await r.fill('input[aria-label="Код сертификата"]', 'MJ-4HWD-8RTA');
  await r.click('button:has-text("Применить")');
  await r.waitForSelector('[role=alert]:has-text("использован")');
  check('used certificate refused', true);
  await r.fill('input[aria-label="Код сертификата"]', tillCode.toLowerCase().replace(/-/g, ' '));
  await r.click('button:has-text("Применить")');
  await r.waitForSelector(`text=Сертификат ${tillCode}`);
  const due = await r.textContent('#check');
  check('certificate covers the receipt', due.includes('К оплате') && /К оплате\s*0 c\./.test(due), due.replace(/\s+/g, ' ').slice(-80));
  await r.click('button:has-text("Наличные")');
  await r.waitForSelector('text=/сертификат 180 c./', { timeout: 10000 });
  check('paid with the certificate', true);
  const left = await fetch(BASE + '/cms/certificates').then(() => sql(`select balance from "GiftCard" where code = '${tillCode}'`));
  check('certificate balance reduced', left === '320', left);

  // ── Bot: prepayment link ──────────────────────────────
  await o.goto(BASE + '/cms/integrations/telegram');
  await o.waitForSelector('text=/Здравствуйте, Мавзуна/');
  const bot = (sel) => o.locator('[aria-live=polite]').locator(sel);
  await bot('button[data-cb=book]').last().click();
  await bot('button:has-text("Макияж и образы")').last().click();
  await bot('button:has-text("Свадебный образ под ключ")').last().click();
  await bot('button[data-cb="m:any"]').last().click();
  await bot('button[data-cb^="d:"]').nth(4).click();
  await o.waitForTimeout(700);
  await bot('button[data-cb^="t:"]').first().click();
  await o.waitForTimeout(700);
  if (await bot('button[data-cb="ok"]').count()) await bot('button[data-cb="ok"]').last().click();
  else {
    await o.fill('input[aria-label="Номер, которым поделиться"]', '93 666 77 88');
    await o.click('button:has-text("Поделиться номером")');
    await o.waitForTimeout(700);
    await bot('button[data-cb="ok"]').last().click();
  }
  await o.waitForSelector('a[data-url*="/oplata/"]');
  check('bot sends the prepayment link', (await text(o, '[aria-live=polite]')).includes('нужна предоплата 450 c.'));
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
} finally {
  await b.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exit(1);
