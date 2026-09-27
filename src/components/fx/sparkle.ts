import { prefersReducedMotion } from "@/lib/fx/reduced-motion";

/** Gold star burst from an element's centre (or a point). Used after a successful booking or payment. */
export function sparkle(target: Element | { x: number; y: number }) {
  if (prefersReducedMotion()) return;
  let x: number;
  let y: number;
  if (target instanceof Element) {
    const r = target.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else {
    ({ x, y } = target);
  }
  for (let i = 0; i < 16; i++) {
    const s = document.createElement("div");
    const size = 6 + Math.random() * 8;
    Object.assign(s.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      margin: `-${size / 2}px 0 0 -${size / 2}px`,
      pointerEvents: "none",
      zIndex: "99997",
      background: "var(--mj-gold)",
      clipPath: "polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)",
    });
    document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 70;
    const anim = s.animate(
      [
        { transform: "translate(0,0) scale(.3) rotate(0deg)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d - 20}px) scale(1) rotate(90deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(a) * d * 1.15}px,${Math.sin(a) * d + 10}px) scale(.2) rotate(140deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    anim.onfinish = () => s.remove();
  }
}
