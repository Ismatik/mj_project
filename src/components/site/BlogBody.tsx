import Link from "next/link";
import { parseBody, type Inline } from "@/lib/blog";
import s from "./blog.module.css";

// Renders the article markup as React elements - never raw HTML.

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.t === "b" ? (
          <strong key={i}>{p.v}</strong>
        ) : p.t === "a" ? (
          p.href.startsWith("/") ? (
            <Link key={i} href={p.href}>
              {p.v}
            </Link>
          ) : (
            <a key={i} href={p.href} target={p.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
              {p.v}
            </a>
          )
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </>
  );
}

export function BlogBody({ text }: { text: string }) {
  return (
    <div className={s.body}>
      {parseBody(text).map((b, i) =>
        b.t === "h2" ? (
          <h2 key={i}>{b.v}</h2>
        ) : b.t === "ul" ? (
          <ul key={i}>
            {b.items.map((it, k) => (
              <li key={k}>
                <Inlines parts={it} />
              </li>
            ))}
          </ul>
        ) : b.t === "quote" ? (
          <blockquote key={i}>
            <Inlines parts={b.v} />
          </blockquote>
        ) : (
          <p key={i}>
            <Inlines parts={b.v} />
          </p>
        ),
      )}
    </div>
  );
}
