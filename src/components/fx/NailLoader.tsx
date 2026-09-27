"use client";

import { useEffect, useId, useState } from "react";
import { useReducedMotion } from "@/lib/fx/reduced-motion";

// Loader variant "mono" from design/mj-fx.js: MJ monogram with five almond nails painted in turn, each gaining a gold glint.

const INK = "var(--mj-ink)";
const CREAM = "var(--mj-cream)";
const GOLD = "var(--mj-gold)";
const NAILS = 5;

function almond(w: number, h: number) {
  return (
    `M0 ${-h / 2} C${0.56 * w} ${-0.42 * h} ${0.5 * w} ${0.26 * h} ${0.42 * w} ${0.42 * h}` +
    ` Q0 ${0.56 * h} ${-0.42 * w} ${0.42 * h} C${-0.5 * w} ${0.26 * h} ${-0.56 * w} ${-0.42 * h} 0 ${-h / 2} Z`
  );
}

function Nail({ uid, i, painted, glint }: { uid: string; i: number; painted: boolean; glint: boolean }) {
  const w = 12;
  const h = 22;
  const d = almond(w, h);
  const clip = `${uid}-n${i}`;
  return (
    <g transform={`translate(${49 + i * 18} 116)`}>
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={CREAM} stroke={INK} strokeWidth={1.3} />
      <g clipPath={`url(#${clip})`}>
        <rect
          x={-w / 2 - 1}
          y={-h / 2 - 1}
          width={w + 2}
          height={h + 2}
          fill={INK}
          style={{
            transformBox: "fill-box",
            transformOrigin: "50% 100%",
            transform: painted ? "scaleY(1)" : "scaleY(0)",
            transition: "transform .34s var(--mj-ease)",
          }}
        />
      </g>
      <path
        d={`M${-w * 0.2} ${-h * 0.28} Q${-w * 0.3} 0 ${-w * 0.18} ${h * 0.2}`}
        fill="none"
        stroke={GOLD}
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ opacity: glint ? 1 : 0, transition: "opacity .3s" }}
      />
    </g>
  );
}

export function NailLoader({ width = 160 }: { width?: number }) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const [painted, setPainted] = useState(0);
  const [glints, setGlints] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let step = 0;
    let alive = true;
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));
    const tick = () => {
      if (step < NAILS) {
        step++;
        const s = step;
        setPainted(s);
        later(() => setGlints(s), 300);
        later(tick, 440);
      } else {
        later(() => {
          step = 0;
          setPainted(0);
          setGlints(0);
          later(tick, 480);
        }, 700);
      }
    };
    later(tick, 250);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [reduced]);

  const shownPainted = reduced ? NAILS : painted;
  const shownGlints = reduced ? NAILS : glints;

  return (
    <svg viewBox="0 0 170 150" width={width} height={Math.round((width * 150) / 170)} style={{ overflow: "visible", display: "block" }} aria-hidden="true">
      <rect x={55} y={12} width={60} height={54} fill="none" stroke={INK} strokeWidth={2.2} />
      <text x={85} y={50} textAnchor="middle" fontFamily="var(--mj-serif)" fontSize={26} fontWeight={600} fill={INK}>
        MJ
      </text>
      <text x={85} y={84} textAnchor="middle" fontFamily="var(--mj-sans)" fontSize={7.5} letterSpacing={2.6} fill={INK}>
        MAVZUNAI JOVID
      </text>
      {Array.from({ length: NAILS }, (_, i) => (
        <Nail key={i} uid={uid} i={i} painted={i < shownPainted} glint={i < shownGlints} />
      ))}
    </svg>
  );
}
