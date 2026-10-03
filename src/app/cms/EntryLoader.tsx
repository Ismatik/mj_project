"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderScreen } from "@/components/fx/FxProvider";
import { prefersReducedMotion } from "@/lib/fx/reduced-motion";

/** "Открываем салон…" - the MJ loader right after signing in (?welcome=1). Rendered on the server so nothing flashes first. */
export function EntryLoader() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const welcome = params.get("welcome") === "1";
  const [phase, setPhase] = useState<"show" | "hide" | "gone">(welcome ? "show" : "gone");

  useEffect(() => {
    if (!welcome) return;
    const ms = prefersReducedMotion() ? 400 : 1900;
    const t1 = setTimeout(() => setPhase("hide"), ms);
    const t2 = setTimeout(() => {
      setPhase("gone");
      const rest = new URLSearchParams(params);
      rest.delete("welcome");
      router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
    }, ms + 520);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [welcome, params, pathname, router]);

  if (phase === "gone") return null;
  return <LoaderScreen label="Открываем салон…" hiding={phase === "hide"} />;
}
