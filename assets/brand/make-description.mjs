import pw from "playwright";

const INK = "#26221d", CREAM = "#f2ede3", GOLD = "#b8a06a", GOLD_DEEP = "#8f7a4b", ONINK = "#d9cfbb";

// Designed at 640x360 natively — that is the size BotFather wants for the
// description picture, and type scaled down from a bigger canvas turns to mush.
const head = `<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@400;600&family=Jost:wght@300;400&display=swap" rel="stylesheet">
<style>
 *{margin:0;padding:0;box-sizing:border-box}
 html,body{width:640px;height:360px}
 body{background:${INK};font-family:"Jost",sans-serif;color:${ONINK}}
 .serif{font-family:"Zen Old Mincho",serif}
</style>`;

const a = `<!doctype html><html><head>${head}<style>
 body{display:flex;align-items:center;padding:0 46px}
 .badge{flex:0 0 172px;height:172px;border-radius:50%;border:1px solid ${GOLD_DEEP};display:grid;place-items:center}
 .mj{font-size:76px;font-weight:600;color:${GOLD};letter-spacing:3px;line-height:1.3;text-indent:3px}
 .right{padding-left:42px;border-left:1px solid #3a342b;margin-left:42px}
 .kicker{font-size:11px;font-weight:300;letter-spacing:4.5px;color:${GOLD};text-transform:uppercase;margin-bottom:5px}
 h1{font-size:29px;font-weight:400;color:${CREAM};margin-bottom:16px}
 li{list-style:none;font-size:16px;font-weight:300;line-height:1.95;color:${ONINK}}
 li b{color:${GOLD};font-weight:300;margin-right:9px}
</style></head><body>
 <div class="badge"><div class="mj serif">MJ</div></div>
 <div class="right">
   <div class="kicker">Mavzunai Jovid</div>
   <h1 class="serif">Gallery of Beauty</h1>
   <ul>
     <li><b>&#10022;</b>Запись к мастеру за минуту</li>
     <li><b>&#10022;</b>Перенос и отмена без звонка</li>
     <li><b>&#10022;</b>Цены, акции и бонусы</li>
   </ul>
 </div></body></html>`;

const b_ = `<!doctype html><html><head>${head}<style>
 body{display:grid;place-items:center;text-align:center}
 .frame{width:570px;height:292px;border:1px solid #3a342b;display:grid;place-items:center}
 .star{font-size:15px;color:${GOLD};margin-bottom:1px}
 .mj{font-size:64px;font-weight:600;color:${GOLD};letter-spacing:4px;line-height:1.3;text-indent:4px}
 h1{font-size:27px;font-weight:400;color:${CREAM};margin:0 0 10px}
 .kicker{font-size:11px;font-weight:300;letter-spacing:4.5px;color:${GOLD};text-transform:uppercase}
 .rule{width:60px;height:1px;background:${GOLD_DEEP};margin:17px auto}
 p{font-size:16px;font-weight:300;line-height:1.7;color:${ONINK}}
</style></head><body>
 <div class="frame"><div>
   <div class="star">&#10022;</div>
   <div class="mj serif">MJ</div>
   <h1 class="serif">Gallery of Beauty</h1>
   <div class="kicker">Салон красоты и свадебный зал &middot; Душанбе</div>
   <div class="rule"></div>
   <p>Записаться, перенести или отменить визит.<br>Цены, акции и бонусы.</p>
 </div></div></body></html>`;

const br = await pw.chromium.launch();
const p = await br.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
for (const [n, html] of [["welcome-a", a], ["welcome-b", b_]]) {
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `run-output/avatar/${n}.png` });
}
await br.close();
console.log("ok");
