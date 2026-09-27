"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchHit, SearchResults } from "@/server/search";
import s from "./cms.module.css";

const GROUPS: { key: keyof SearchResults; label: string }[] = [
  { key: "guests", label: "Гостьи" },
  { key: "appointments", label: "Записи" },
  { key: "sales", label: "Чеки" },
];

/** Header search with grouped results and keyboard navigation (↑ ↓ Enter Esc). "/" focuses it. */
export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const hits: SearchHit[] = results ? GROUPS.flatMap((g) => results[g.key]) : [];

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cms/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setResults(await res.json());
          setActive(0);
        }
      } catch {
        /* aborted or offline */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQ("");
    setResults(null);
    input.current?.blur();
    router.push(hit.href);
  };

  const showList = open && q.trim().length >= 2 && results;
  let index = -1;

  return (
    <div className={s.search}>
      <input
        ref={input}
        className={s.searchInput}
        type="search"
        placeholder="Найти гостью, запись или счёт…"
        aria-label="Поиск"
        role="combobox"
        aria-expanded={!!showList}
        aria-controls={listId}
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (e.target.value.trim().length < 2) setResults(null);
        }}
        onFocus={() => {
          clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            go(hits[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <div className={s.results} id={listId} role="listbox">
          {hits.length === 0 && <div className={s.noResults}>Ничего не нашлось по «{q.trim()}»</div>}
          {GROUPS.map((g) =>
            results[g.key].length ? (
              <div key={g.key} role="group" aria-label={g.label}>
                <div className={s.resultGroup}>{g.label}</div>
                {results[g.key].map((hit) => {
                  index++;
                  const i = index;
                  return (
                    <a
                      key={hit.id}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      href={hit.href}
                      className={`${s.result} ${i === active ? s.resultActive : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        go(hit);
                      }}
                      onMouseEnter={() => setActive(i)}
                    >
                      <div className={s.resultTitle}>{hit.title}</div>
                      <div className={s.resultSub}>{hit.sub}</div>
                    </a>
                  );
                })}
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
