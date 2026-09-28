"use client";

import { useOptimistic, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import s from "@/components/site/site.module.css";
import { dict } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/locales";
import { setFavouriteMaster } from "../../kabinet/actions";

/** "★ Мой мастер" toggle for a signed-in guest. */
export function FavouriteButton({ staffId, initial, lang }: { staffId: string; initial: boolean; lang: Lang }) {
  const t = dict(lang).masters;
  const fx = useFx();
  const [on, setOn] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      className={s.btnGhost}
      aria-pressed={on}
      onClick={() =>
        start(async () => {
          setOn(!on);
          await setFavouriteMaster(on ? null : staffId);
          fx.toast(on ? t.favRemoved : t.favAdded, "MJ");
        })
      }
    >
      {on ? t.favOn : t.favOff}
    </button>
  );
}
