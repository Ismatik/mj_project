"use client";
/* eslint-disable @next/next/no-img-element -- photos come from the admin (uploads or external links), shown as-is in black and white */

import { useEffect, useRef, useState } from "react";
import type { SitePhoto } from "@/lib/site-content";
import s from "./site.module.css";

/** Black-and-white photo with the blur-up effect from mj-fx.js: blurred until it has loaded. */
export function Photo({ photo, alt, parallax = true, eager = false }: { photo: SitePhoto; alt: string; parallax?: boolean; eager?: boolean }) {
  const img = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <>
      <div className={s.photoLayer} data-parallax={parallax ? "" : undefined}>
        <img
          ref={img}
          src={photo.url}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          style={{
            filter: loaded ? "grayscale(1)" : "grayscale(1) blur(18px)",
            transform: loaded ? "none" : "scale(1.03)",
            transition: "filter 1s var(--mj-ease), transform 1s var(--mj-ease)",
          }}
        />
      </div>
      {photo.credit &&
        (photo.creditUrl ? (
          <a className={s.credit} href={photo.creditUrl} target="_blank" rel="noopener noreferrer">
            {photo.credit}
          </a>
        ) : (
          <span className={s.credit}>{photo.credit}</span>
        ))}
    </>
  );
}
