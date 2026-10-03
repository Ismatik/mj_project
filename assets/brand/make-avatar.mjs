import pw from "playwright";

const INK = "#26221d", CREAM = "#f2ede3", GOLD = "#b8a06a", GOLD_DEEP = "#8f7a4b";

// Telegram crops the square to a circle and shows it at ~40px in the chat list,
// so the monogram carries the whole thing and anything else stays optional.
const art = ({ bg, fg, ring, accent, sub }) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@400;600&family=Jost:wght@300;400&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:512px;height:512px}
  body{background:${bg};display:grid;place-items:center;font-family:"Zen Old Mincho",serif}
  .ring{width:468px;height:468px;border-radius:50%;border:2px solid ${ring};display:grid;place-items:center}
  .stack{display:flex;flex-direction:column;align-items:center;transform:translateY(${sub ? "-6px" : "0"})}
  .star{font-family:"Jost",sans-serif;font-size:${sub ? 30 : 36}px;color:${accent};line-height:1;margin-bottom:${sub ? 10 : 16}px}
  .mj{font-size:${sub ? 170 : 205}px;font-weight:600;color:${fg};letter-spacing:6px;line-height:1.32;text-indent:6px}
  .sub{font-family:"Jost",sans-serif;font-size:17px;font-weight:300;letter-spacing:8px;color:${accent};margin-top:2px;text-indent:8px}
</style></head><body>
<div class="ring"><div class="stack">
  <div class="star">&#10022;</div>
  <div class="mj">MJ</div>
  ${sub ? '<div class="sub">GALLERY OF BEAUTY</div>' : ""}
</div></div></body></html>`;

const VARIANTS = [
  ["a-dark",       art({ bg: INK,   fg: GOLD, ring: GOLD_DEEP, accent: GOLD,      sub: true  })],
  ["b-dark-clean", art({ bg: INK,   fg: GOLD, ring: GOLD_DEEP, accent: GOLD,      sub: false })],
  ["c-cream",      art({ bg: CREAM, fg: INK,  ring: GOLD,      accent: GOLD_DEEP, sub: true  })],
  ["d-gold",       art({ bg: GOLD,  fg: INK,  ring: INK,       accent: INK,       sub: false })],
];

const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, html] of VARIANTS) {
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `run-output/avatar/${name}.png` });
}
// How each looks in the chat list, where it is about 40 px across
await p.setViewportSize({ width: 240, height: 64 });
await p.setContent(`<body style="margin:0;background:#fff;display:flex;gap:14px;align-items:center;padding:12px">
  ${VARIANTS.map(([n]) => `<img src="file://${process.cwd()}/run-output/avatar/${n}.png" width="40" height="40" style="border-radius:50%">`).join("")}
</body>`, { waitUntil: "networkidle" });
await p.screenshot({ path: "run-output/avatar/z-tiny.png" });
await b.close();
console.log("ok");
