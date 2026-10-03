// Russian / Tajik / English website, admin translations, message templates, bot language and the live WhatsApp driver.
// Run against a freshly seeded app started with a stand-in for Meta's API (see e2e/README.md):
//   WHATSAPP_TOKEN=test-token WHATSAPP_PHONE_ID=10001 WHATSAPP_APP_SECRET=test-app-secret WHATSAPP_VERIFY_TOKEN=test-verify
//   WHATSAPP_API_BASE=http://127.0.0.1:3999 WHATSAPP_WABA_ID=20002 DEMO_LOGIN_CODES=1
import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
const SECRET = process.env.WHATSAPP_APP_SECRET ?? 'test-app-secret';
const VERIFY = process.env.WHATSAPP_VERIFY_TOKEN ?? 'test-verify';
const FAKE_PORT = Number(process.env.FAKE_META_PORT ?? 3999);
mkdirSync(out, { recursive: true });

// Stand-in for graph.facebook.com: records what the app sends
const sent = [];
const templates = [];
const meta = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = JSON.parse(body || '{}');
    res.setHeader('Content-Type', 'application/json');
    // Message templates of the WhatsApp Business Account
    if (req.url.includes('/message_templates')) {
      if (req.method === 'GET') return res.end(JSON.stringify({ data: templates.map((t) => ({ name: t.name, language: t.language, status: 'PENDING', category: t.category })) }));
      if (templates.some((t) => t.name === json.name && t.language === json.language)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: { message: 'Message template already exists', code: 100, error_subcode: 2388024 } }));
      }
      templates.push(json);
      return res.end(JSON.stringify({ id: `tpl${templates.length}`, status: 'PENDING', category: json.category }));
    }
    sent.push({ url: req.url, auth: req.headers.authorization, json });
    res.end(JSON.stringify({ messaging_product: 'whatsapp', contacts: [{ wa_id: json.to }], messages: [{ id: `wamid.TEST${sent.length}` }] }));
  });
});
await new Promise((r) => meta.listen(FAKE_PORT, '127.0.0.1', r));

const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' - ' + extra : ''}`);
const ctxOf = async (w = 1360, h = 900) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'en-US', timezoneId: 'Asia/Dushanbe' });
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
const times = (p) => p.$$eval('#zapis button', (bs) => bs.map((x) => x.textContent.trim()).filter((t) => /^\d\d:\d\d$/.test(t)));
async function bookEnglish(p, name, phone) {
  await p.goto(BASE + '/en#zapis');
  await p.click('#zapis [role=tab]:has-text("Brows & lashes")');
  await p.click('#zapis button:has-text("Lash lamination")');
  await p.click('#zapis button:text-is("Mira")');
  await p.locator('#zapis button:has(small)').nth(1).click(); // Wednesday (Mira is off on Thursdays)
  await p.waitForFunction(() => [...document.querySelectorAll('#zapis button')].some((x) => /^\d\d:\d\d$/.test(x.textContent.trim())));
  const t = (await times(p))[0];
  await p.click(`#zapis button:text-is("${t}")`);
  await p.fill('input[name=name]', name);
  await p.fill('input[name=phone]', phone);
  await p.click(`#zapis button:has-text("Book for ${t}")`);
  await p.waitForSelector(`text=Thank you, ${name}!`, { timeout: 10000 });
  return (await p.textContent('#zapis [role=status]')) ?? '';
}
const sign = (body) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
const hook = (json, signed = true) => {
  const body = JSON.stringify(json);
  return fetch(BASE + '/api/whatsapp/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(signed ? { 'X-Hub-Signature-256': sign(body) } : {}) }, body });
};

try {
  // ── Website in three languages ────────────────────────
  const guest = await pageOf(await ctxOf());
  await guest.goto(BASE + '/en');
  check('English home: html lang and nav', (await guest.getAttribute('html', 'lang')) === 'en' && (await guest.textContent('nav')).includes('Services'));
  check('English texts from the content', (await guest.textContent('h1')).includes('Beauty'));
  const alt = await guest.$$eval('link[rel=alternate][hreflang]', (ls) => ls.map((l) => `${l.getAttribute('hreflang')}=${new URL(l.href).pathname}`));
  check('hreflang alternates', ['ru=/', 'tg=/tj', 'en=/en'].every((x) => alt.includes(x)), alt.join(' '));
  check('prices in TJS', (await guest.textContent('#uslugi')).includes('TJS'));
  await guest.goto(BASE + '/tj/mastera');
  check('Tajik masters page', (await guest.getAttribute('html', 'lang')) === 'tg' && (await guest.textContent('h1')).includes('Устоҳои мо'));
  await guest.goto(BASE + '/mastera');
  await guest.click('nav [role=group] a[hreflang=en]');
  await guest.waitForURL(/\/en\/mastera$/);
  check('language switch keeps the page', (await guest.textContent('h1')).includes('Our masters'));
  check('/en/cms is not a page', (await fetch(BASE + '/en/cms')).status === 404);
  await guest.screenshot({ path: out + '/en-masters.png' });

  // An English-speaking guest books; the summary is in English
  const summary = await bookEnglish(guest, 'Anna Smith', '93 555 66 77');
  check('English booking summary', summary.includes('Lash lamination') && summary.includes('with Mira') && /day, \d+ \w+ 2026/.test(summary), summary.slice(0, 120));

  // Her account in English
  await guest.goto(BASE + '/en/kabinet');
  await guest.fill('input[name=phone]', '93 555 66 77');
  await guest.click('button:has-text("Get a code")');
  await guest.waitForSelector('text=Demo mode');
  const code = (await guest.textContent('div:has-text("Demo mode") >> b')).trim();
  await guest.fill('input[name=code]', code);
  await guest.click('button:has-text("Sign in")');
  await guest.waitForSelector('text=Hello, Anna');
  const acc = await guest.textContent('main');
  check('English account', acc.includes('Upcoming bookings') && acc.includes('Lash lamination') && acc.includes('Awaiting confirmation'));
  check('message language is English', (await guest.getAttribute('button[aria-pressed=true]:has-text("English")', 'lang')) === 'en');
  await guest.screenshot({ path: out + '/en-account.png', fullPage: true });

  // ── Admin: translate texts and a service name ─────────
  const content = await login('content');
  await content.goto(BASE + '/admin#texts');
  await content.click('[role=tab]:has-text("English")');
  const heroTitle = content.locator('textarea[aria-label="Заголовок"]').first();
  check('translate tab shows the English text', (await heroTitle.inputValue()).startsWith('Beauty'));
  await heroTitle.fill('Beauty\nthat shines');
  await content.click('button:has-text("Услуги и цены")');
  await content.fill('input[aria-label="Услуга: Педикюр"]', 'Classic pedicure');
  await content.waitForSelector('text=Есть неопубликованные изменения');
  await content.waitForTimeout(1200);
  await content.click('button:has-text("Опубликовать")');
  await content.waitForSelector('text=Изменения опубликованы');
  const enHome = await pageOf(await ctxOf());
  await enHome.goto(BASE + '/en');
  const enText = await enHome.textContent('body');
  check('translation published', enText.includes('that shines') && enText.includes('Classic pedicure'));
  await enHome.goto(BASE + '/');
  check('Russian untouched', (await enHome.textContent('h1')).includes('Красота') && (await enHome.textContent('#uslugi')).includes('Педикюр'));

  // ── Owner: template, bot language, WhatsApp live ──────
  const owner = await login('mavzuna');
  await owner.goto(BASE + '/cms/integrations/templates');
  await owner.fill('textarea[aria-label="Подтверждение онлайн-записи - English"]', 'Mavzunai Jovid: {name}, see you {when} for {service}!');
  await owner.click('button:has-text("Сохранить шаблоны")');
  await owner.waitForSelector('text=Шаблоны сохранены');
  check('template saved', (await owner.textContent('main')).includes('Marta, see you Wednesday'));

  // WhatsApp templates go to Meta from the CMS; a second press finds them already there
  await owner.click('button:has-text("Отправить шаблоны в Meta")');
  await owner.waitForSelector('[role=status]:has-text("Готово")');
  check('templates submitted to Meta', templates.length === 12 && (await owner.textContent('[role=status]:has-text("Готово")')).includes('отправлено 12'), String(templates.length));
  check('auth template in Meta format', templates.some((t) => t.name === 'mj_login_code' && t.category === 'AUTHENTICATION' && t.language === 'ru'));
  await owner.reload();
  check('approval status shown', (await owner.$$('text=на проверке')).length === 12);
  await owner.click('button:has-text("Отправить шаблоны в Meta")');
  await owner.waitForSelector('[role=status]:has-text("уже были 12")');
  check('resubmitting is harmless', templates.length === 12);

  await owner.goto(BASE + '/cms/integrations/telegram');
  await owner.click('button:has-text("Сбросить")').catch(() => {});
  await owner.fill('input[aria-label="Сообщение боту"]', '/start');
  await owner.press('input[aria-label="Сообщение боту"]', 'Enter');
  await owner.waitForSelector('button[data-cb=lang]');
  await owner.click('button[data-cb=lang] >> nth=-1');
  await owner.click('button[data-cb="lang:en"] >> nth=-1');
  await owner.waitForSelector("text=Done - I'll speak English now");
  check('bot switches to English', (await owner.$$('button[data-cb=book]:has-text("✦ Book")')).length > 0);

  await owner.goto(BASE + '/cms/integrations');
  await owner.click('[aria-label="WhatsApp: режим"] button:has-text("Живой")');
  await owner.waitForSelector('[aria-label="WhatsApp: режим"] button[aria-pressed=true]:has-text("Живой")');
  check('WhatsApp switched to live', true);

  // A new English guest books → template message through the (fake) Cloud API
  const g2 = await pageOf(await ctxOf());
  await bookEnglish(g2, 'Lola Brown', '93 444 22 11');
  await owner.reload();
  await owner.click('button:has-text("Доставить сейчас")');
  await owner.waitForSelector('text=Обработано сообщений');
  const conf = sent.find((x) => x.json.type === 'template' && x.json.to === '992934442211');
  check('confirmation sent as an approved template', !!conf && conf.json.template.name === 'mj_booking_confirmation' && conf.json.template.language.code === 'en', JSON.stringify(conf?.json.template ?? {}).slice(0, 160));
  check('template parameters in English', !!conf && conf.json.template.components[0].parameters[0].text === 'Lola' && conf.json.template.components[0].parameters[1].text === 'Lash lamination');
  check('Cloud API called with the token', !!conf && conf.auth === 'Bearer test-token' && conf.url === '/v22.0/10001/messages');
  await owner.reload();
  const box = await owner.textContent('main');
  check('outbox: custom English text, template noted', box.includes('Lola, see you') && box.includes('шаблон mj_booking_confirmation'));

  // Webhook: verification, signature, delivery failure, guest message
  const verify = await fetch(`${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=42`);
  check('webhook verification', verify.status === 200 && (await verify.text()) === '42');
  check('wrong verify token refused', (await fetch(`${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`)).status === 403);
  check('unsigned webhook refused', (await hook({ entry: [] }, false)).status === 401);
  const wamid = `wamid.TEST${sent.indexOf(conf) + 1}`;
  await hook({ entry: [{ changes: [{ value: { statuses: [{ id: wamid, status: 'failed', errors: [{ code: 131026, title: 'Message undeliverable' }] }] } }] }] });
  const incoming = { entry: [{ changes: [{ value: { contacts: [{ wa_id: '992935012214', profile: { name: 'Marta' } }], messages: [{ id: 'in1', from: '992935012214', type: 'text', text: { body: 'Можно перенести на пятницу?' } }] } }] }] };
  const before = sent.length;
  await hook(incoming);
  await hook({ ...incoming, entry: [{ changes: [{ value: { ...incoming.entry[0].changes[0].value, messages: [{ id: 'in2', from: '992935012214', type: 'image' }] } }] }] });
  const replies = sent.slice(before).filter((x) => x.json.type === 'text' && x.json.to === '992935012214');
  check('guest gets one auto-reply', replies.length === 1 && replies[0].json.text.body.includes('спасибо'), String(replies.length));
  await owner.reload();
  const box2 = await owner.textContent('main');
  check('failed delivery marked', box2.includes('131026 Message undeliverable'));
  check('guest message forwarded to reception', box2.includes('WhatsApp от Марта Каримова') && box2.includes('Можно перенести на пятницу?') && box2.includes('[фото]'));
  await owner.screenshot({ path: out + '/whatsapp-outbox.png' });
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
} finally {
  await b.close();
  meta.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exit(1);
