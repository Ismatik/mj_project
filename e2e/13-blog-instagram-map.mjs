// Blog (written and published in the site admin, translated, safe markup, drafts hidden), sitemap and robots,
// the Instagram feed (mock from the portfolio, live against a local stand-in for Instagram's API),
// "how to find us" with the map loaded on click, and the call bar on phones.
// Start the app with INSTAGRAM_TOKEN=test-ig-token INSTAGRAM_API_BASE=http://127.0.0.1:3998 (the suite serves that port).
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const png = readFileSync(new URL('./fixtures/test.png', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT ?? 'e2e-output';
mkdirSync(out, { recursive: true });
const text = async (p, sel) => ((await p.textContent(sel)) ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ');

// Stand-in for graph.instagram.com
const igCalls = [];
const ig = createServer((req, res) => {
  igCalls.push(req.url);
  res.setHeader('content-type', 'application/json');
  if (req.url.startsWith('/refresh_access_token')) return res.end(JSON.stringify({ access_token: 'test-ig-token-2', token_type: 'bearer', expires_in: 5184000 }));
  if (req.url.startsWith('/me/media')) {
    const data = Array.from({ length: 8 }, (_, i) => ({
      id: `ig${i}`,
      media_type: i === 1 ? 'VIDEO' : 'IMAGE',
      media_url: `https://cdn.ig.test/${i}.jpg`,
      thumbnail_url: `https://cdn.ig.test/${i}-thumb.jpg`,
      permalink: `https://www.instagram.com/p/POST${i}/`,
      caption: i === 0 ? 'Свадебный образ для Мадины ✦ #wedding' : `Работа ${i}`,
      timestamp: '2026-09-20T10:00:00+0000',
    }));
    return res.end(JSON.stringify({ data }));
  }
  res.statusCode = 404;
  res.end('{}');
});
await new Promise((r) => ig.listen(3998, '127.0.0.1', r));

const b = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' - ' + extra : ''}`);
const ctxOf = async (w = 1360, h = 900) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'ru-RU', timezoneId: 'Asia/Dushanbe' });
  await c.route(/unsplash|cdn\.ig\.test/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await c.route(/maps\.google\.com|google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>map</body></html>' }));
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
  // ── Public blog ───────────────────────────────────────
  const g = await pageOf(await ctxOf());
  await g.goto(BASE + '/');
  const tips = await text(g, '#sovety');
  check('latest tips on the home page', tips.includes('Подготовка к свадьбе') && tips.includes('Как сохранить цвет'));
  await g.goto(BASE + '/blog');
  const list = await text(g, 'main');
  check('blog list', list.includes('Гель-лак без сколов') && !list.includes('Брови осенью'));
  await g.click('nav[aria-label="Темы"] a:has-text("ногти")');
  await g.waitForURL(/tag=/);
  check('filter by topic', (await text(g, 'main')).includes('Гель-лак') && !(await text(g, 'main')).includes('Подготовка к свадьбе'));
  await g.goto(BASE + '/blog/uhod-za-okrashennymi-volosami');
  const post = await text(g, 'article');
  check('article with headings, list, quote', (await g.$$('article h2')).length === 2 && (await g.$$('article li')).length === 4 && (await g.$('article blockquote')) !== null);
  check('book button goes to the service', (await g.getAttribute('article a:has-text("Записаться")', 'href')).includes('?service=') && post.includes('Окрашивание в один тон'));
  const ld = JSON.parse(await g.textContent('script[type="application/ld+json"]'));
  check('article structured data', ld['@type'] === 'Article' && ld.headline === 'Как сохранить цвет после окрашивания');
  await g.goto(BASE + '/en/blog/uhod-za-okrashennymi-volosami');
  check('article in English', (await text(g, 'article')).includes('How to keep your colour after dyeing'));
  await g.goto(BASE + '/tj/blog/podgotovka-k-svadbe');
  check('untranslated article falls back to Russian', (await text(g, 'article')).includes('календарь невесты'));
  const draft = await g.goto(BASE + '/blog/brovi-osen');
  check('drafts are not public', draft.status() === 404);
  const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
  check('sitemap', sitemap.includes('/blog/gel-lak-bez-skolov') && sitemap.includes('/en/svadba') && !sitemap.includes('brovi-osen'));
  const robots = await (await fetch(BASE + '/robots.txt')).text();
  check('robots', robots.includes('Disallow: /cms') && robots.includes('sitemap.xml'));

  // ── Site admin: write, translate, publish ─────────────
  const a = await login('content');
  await a.goto(BASE + '/admin#blog');
  await a.click('button:has-text("Блог и советы")');
  await a.click('button:has-text("+ Новая статья")');
  await a.fill('input[aria-label="Заголовок статьи"]', 'Уход за кожей зимой');
  check('address from the title', (await a.inputValue('input[aria-label="Адрес статьи"]')) === 'ukhod-za-kozhey-zimoy');
  await a.fill('textarea[aria-label="Кратко"]', 'Как защитить кожу от холода.');
  await a.fill('textarea[aria-label="Текст статьи"]', 'Зимой коже нужно больше влаги.\n\n## Главное\n- Плотный крем\n- **SPF** даже зимой\n\nКлик [сюда](javascript:alert(1)) ничего не делает, а [запись](/#zapis) работает.');
  await a.fill('input[aria-label="Теги"]', 'уход, кожа');
  await a.selectOption('select[aria-label="Услуга для записи"]', { label: 'Уход за кожей' });
  await a.click('main button:has-text("Опубликовать")');
  await a.waitForSelector('text=Статья опубликована');
  await a.click('[role=tab]:has-text("English")');
  await a.click('[data-post="ukhod-za-kozhey-zimoy"] button:has-text("Редактировать")');
  await a.fill('input[aria-label="Заголовок статьи"]', 'Winter skin care');
  await a.click('main button:has-text("Сохранить")');
  await a.waitForSelector('text=Статья сохранена');
  await a.screenshot({ path: out + '/admin-blog.png', fullPage: true });
  await g.goto(BASE + '/blog/ukhod-za-kozhey-zimoy');
  const html = await g.content();
  check('published from the admin', (await text(g, 'article')).includes('Плотный крем') && (await g.$$('article li')).length === 2);
  check('unsafe link rendered as text', !html.includes('javascript:') && (await g.getAttribute('article a:has-text("запись")', 'href')) === '/#zapis');
  await g.goto(BASE + '/en/blog/ukhod-za-kozhey-zimoy');
  check('translation saved', (await text(g, 'article h1')).includes('Winter skin care'));
  await a.goto(BASE + '/blog/brovi-osen?preview=1');
  check('editors preview drafts', (await text(a, 'main')).includes('Черновик - видят только редакторы'));

  // ── Map and call bar ──────────────────────────────────
  await g.goto(BASE + '/');
  await g.locator('#kak-dobratsya').scrollIntoViewIfNeeded();
  const find = await text(g, '#kak-dobratsya');
  check('how to find us', find.includes('ул. Бухоро') && (await g.getAttribute('#kak-dobratsya a:has-text("Позвонить")', 'href')) === 'tel:+992981031111');
  check('route links', (await g.getAttribute('#kak-dobratsya a:has-text("2ГИС")', 'href')).startsWith('https://2gis.tj/') && (await g.getAttribute('#kak-dobratsya a:has-text("Google Maps")', 'href')).includes('destination='));
  check('no map requests before asked', (await g.$$('#kak-dobratsya iframe')).length === 0);
  await g.click('button:has-text("Показать карту")');
  await g.waitForSelector('#kak-dobratsya iframe');
  check('map on click', (await g.getAttribute('#kak-dobratsya iframe', 'src')).includes('output=embed'));
  const m = await pageOf(await ctxOf(390, 800));
  await m.goto(BASE + '/blog');
  check('call bar on phones', (await m.isVisible('nav[aria-label="Позвонить"]')) && !(await g.isVisible('nav[aria-label="Позвонить"]')));
  await m.screenshot({ path: out + '/mobile-bar.png' });

  // ── Instagram ─────────────────────────────────────────
  await g.goto(BASE + '/');
  const mock = await g.$$eval('#instagram a[href*="instagram.com"]', (as) => as.map((x) => x.href));
  check('mock feed: portfolio linking to the profile', mock.length >= 2 && mock.every((h) => h.includes('instagram.com/mavzunai.jovid.official')));
  const o = await login('mavzuna');
  await o.goto(BASE + '/cms/integrations');
  await o.click('[aria-label="Instagram: режим"] button:has-text("Живой")');
  await o.waitForSelector('button:has-text("Обновить ленту")');
  await o.click('button:has-text("Обновить ленту")');
  await o.waitForSelector('text=Загружено публикаций: 8');
  check('live feed fetched, token refreshed', igCalls.some((u) => u.startsWith('/refresh_access_token')) && igCalls.some((u) => u.includes('access_token=test-ig-token-2')));
  await g.goto(BASE + '/');
  const live = await g.$$eval('#instagram a', (as) => as.map((x) => x.href));
  check('live posts on the site', live.includes('https://www.instagram.com/p/POST0/') && live.length === 7, String(live.length));
  check('video shows its thumbnail', (await g.getAttribute('#instagram a[href$="POST1/"] img', 'src')) === 'https://cdn.ig.test/1-thumb.jpg');
  await g.locator('#instagram').screenshot({ path: out + '/instagram.png' });
} catch (e) {
  results.push('ERROR ' + e.message.split('\n')[0]);
} finally {
  await b.close();
  ig.close();
}
console.log(results.join('\n'));
if (results.some((r) => !r.startsWith('PASS'))) process.exit(1);
