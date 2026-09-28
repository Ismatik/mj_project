// End of day at the till (cash in/out, salary from the till, cash count, Z-report), master payroll
// and reports for a period in Excel and PDF; who may see what.
// Run against a freshly seeded app:  npm run db:seed && node e2e/10-payroll-shifts-reports.mjs  (needs DATABASE_URL)
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const text = async (p, sel) => ((await p.textContent(sel)) ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ');
/** Text without any spaces, for label+value pairs in separate elements */
const flat = async (p, sel) => ((await p.textContent(sel)) ?? '').replace(/\s/g, '');
const money = (s) => Number(String(s).replace(/[^\d−-]/g, '').replace('−', '-'));
const sql = (q) => execSync(`psql "${process.env.DATABASE_URL}" -tAc ${JSON.stringify(q)}`).toString().trim();

const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
async function login(name) {
  const c = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe' });
  await c.route(/unsplash|mino\.tj/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  const p = await c.newPage();
  p.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  await p.goto(BASE + '/login');
  await p.fill('input[name=login]', name);
  await p.fill('input[name=password]', 'change-me-now');
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
const file = async (p, url) => {
  const r = await p.request.get(BASE + url);
  const body = await r.body();
  return { status: r.status(), type: r.headers()['content-type'] ?? '', magic: body.subarray(0, 4).toString(), size: body.length, name: decodeURIComponent(r.headers()['content-disposition']?.split("UTF-8''")[1] ?? '') };
};
const expected = async (p) => money(await text(p, '[data-testid=expected]'));

try {
  // ── Reception: a cash receipt, cash taken out ─────────
  const r = await login('reception');
  await r.goto(BASE + '/cms/pos');
  check('till shows the shift is open', (await text(r, 'main')).includes('Смена открыта'));
  await r.goto(BASE + '/cms/pos/shift');
  const e0 = await expected(r);
  check('opening cash carried from yesterday', (await flat(r, 'main')).includes('Наначалодня500c.'));
  await r.goto(BASE + '/cms/pos');
  await r.click('button:has-text("Стрижка + укладка")');
  await r.click('button:has-text("Наличные")');
  await r.waitForSelector('text=/Оплата 180 c. принята/', { timeout: 10000 });
  await r.goto(BASE + '/cms/pos/shift');
  check('cash receipt counted', (await expected(r)) === e0 + 180, `${e0} → ${await expected(r)}`);
  await r.fill('form[aria-label="Внесение или изъятие"] input[name=amount]', '100');
  await r.fill('form[aria-label="Внесение или изъятие"] input[name=note]', 'Вода и кофе');
  await r.click('form[aria-label="Внесение или изъятие"] button[type=submit]');
  await r.waitForSelector('text=Вода и кофе');
  check('cash taken out', (await expected(r)) === e0 + 80);

  // ── Owner: payroll ────────────────────────────────────
  const o = await login('mavzuna');
  await o.goto(BASE + '/cms/payroll');
  const pr = await text(o, 'main');
  check('payroll lists masters with pay', pr.includes('Инес') && pr.includes('Лучшие отзывы') === false && pr.includes('К выплате'));
  const due = async (name) => money(await text(o, `tr[data-staff="${name}"] [data-testid=due]`));
  await o.click('button:has-text("Дарио")');
  const d0 = await due('Дарио');
  await o.fill('form[aria-label="Ставка Дарио"] input[aria-label="Процент"]', '45');
  await o.click('form[aria-label="Ставка Дарио"] button');
  await o.waitForSelector('tr[data-staff="Дарио"] >> text=45%');
  const d1 = await due('Дарио');
  check('commission rate changed', d1 > d0, `${d0} → ${d1}`);
  await o.fill('input[aria-label="Сумма премии или штрафа"]', '500');
  await o.fill('form[aria-label="Премия или штраф Дарио"] input[aria-label="Причина"]', 'Свадьба в субботу');
  await o.click('form[aria-label="Премия или штраф Дарио"] button');
  await o.waitForSelector('text=Свадьба в субботу');
  check('bonus added', (await due('Дарио')) === d1 + 500);
  await o.fill('input[aria-label="Сумма выплаты"]', '1000');
  await o.selectOption('select[aria-label="Способ выплаты"]', 'CARD');
  await o.fill('input[aria-label="Комментарий к выплате"]', 'расчёт');
  await o.click('form[aria-label="Выплата Дарио"] button');
  await o.waitForSelector('text=/перевод · расчёт/');
  check('payout by transfer recorded', (await due('Дарио')) === d1 + 500 - 1000);
  // Cash advance from the till shows in today's shift
  await o.click('button:has-text("Мира")');
  await o.fill('form[aria-label="Выплата Мира"] input[aria-label="Сумма выплаты"]', '200');
  await o.fill('form[aria-label="Выплата Мира"] input[aria-label="Комментарий к выплате"]', 'аванс');
  await o.click('form[aria-label="Выплата Мира"] button');
  await o.waitForSelector('text=/наличные из кассы · аванс/');
  await o.screenshot({ path: out + '/payroll.png', fullPage: true });
  let f = await file(o, '/api/cms/reports/payroll?format=xlsx');
  check('payroll Excel', f.status === 200 && f.magic.startsWith('PK') && f.name.startsWith('MJ-зарплата-'), f.name);
  f = await file(o, '/api/cms/reports/payroll?format=pdf');
  check('payroll PDF', f.status === 200 && f.magic === '%PDF' && f.size > 10000);

  await r.reload();
  check('salary from the till in the shift', (await text(r, 'main')).includes('Зарплата: Мира (аванс)') && (await expected(r)) === e0 + 80 - 200);

  // ── Close the shift with a shortfall ──────────────────
  const exp = await expected(r);
  await r.fill('form[aria-label="Закрыть смену"] input[name=counted]', String(exp - 30));
  check('difference shown before closing', (await flat(r, 'form[aria-label="Закрыть смену"] [role=status]')).includes('Недостача−30c.'));
  await r.fill('form[aria-label="Закрыть смену"] input[name=handed]', String(exp - 30 - 500));
  await r.click('button:has-text("Закрыть смену")');
  await r.waitForSelector('a:has-text("Z-отчёт PDF")');
  const z = await flat(r, 'main');
  check('shift closed with the count', z.includes('Недостача−30c.') && z.includes('Оставленоназавтра500c.') && z.includes('Сменазакрыта:Ресепшен'));
  await r.screenshot({ path: out + '/shift-closed.png', fullPage: true });
  f = await file(r, await r.getAttribute('a:has-text("Z-отчёт PDF")', 'href'));
  check('Z-report PDF', f.status === 200 && f.magic === '%PDF', f.name);
  check('owner told about the shortfall', sql(`select count(*) from "OutboxMessage" where body like '%закрыта с недостачей 30 c.%'`) === '1');
  check('no more cash moves after closing', !(await r.isVisible('form[aria-label="Внесение или изъятие"]')));
  await r.goto(BASE + '/cms/pos');
  check('till says the shift is closed', (await text(r, 'main')).includes('Смена на сегодня закрыта'));
  await o.goto(BASE + '/cms/payroll');
  await o.click('button:has-text("Петра")');
  await o.fill('form[aria-label="Выплата Петра"] input[aria-label="Сумма выплаты"]', '100');
  await o.click('form[aria-label="Выплата Петра"] button');
  await o.waitForSelector('text=Смена на сегодня закрыта — выдайте завтра или переводом');
  check('no cash payout from a closed till', true);

  // ── Reports ───────────────────────────────────────────
  await o.goto(BASE + '/cms/reports');
  await o.click('[aria-label="Период"] a:has-text("Сегодня")');
  await o.waitForURL(/from=/);
  const rep = await text(o, 'main');
  check('report for today with the closed shift', rep.includes('Стрижка + укладка') && rep.includes('−30 c.'));
  await o.screenshot({ path: out + '/reports.png', fullPage: true });
  const xls = await o.getAttribute('a:has-text("Скачать Excel")', 'href');
  f = await file(o, xls);
  check('period Excel', f.status === 200 && f.magic.startsWith('PK') && f.type.includes('spreadsheetml'), f.name);
  f = await file(o, xls.replace('format=xlsx', 'format=pdf'));
  check('period PDF', f.status === 200 && f.magic === '%PDF');
  f = await file(o, '/api/cms/reports/period?from=2026-01-01&to=2025-01-01&format=xlsx');
  check('odd period falls back safely', f.status === 200);

  // ── Who may see what ──────────────────────────────────
  const m = await login('mira');
  await m.goto(BASE + '/cms/payroll');
  const mine = await text(m, 'main');
  check('master sees only her own pay', mine.includes('Моя зарплата') && mine.includes('Мира') && !mine.includes('Инес') && !(await m.isVisible('input[aria-label="Сумма выплаты"]')));
  check('master cannot download reports', (await file(m, '/api/cms/reports/period?format=xlsx')).status === 403);
  check('master payroll file is hers', (await file(m, '/api/cms/reports/payroll?format=xlsx')).status === 200);
  check('reception cannot open payroll', (await file(r, '/api/cms/reports/payroll?format=xlsx')).status === 403);
  await r.goto(BASE + '/cms/reports');
  await r.waitForURL((u) => u.pathname === '/cms', { timeout: 5000 }).catch(() => {});
  check('reception is sent away from reports', new URL(r.url()).pathname === '/cms');
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
} finally {
  await b.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exit(1);
