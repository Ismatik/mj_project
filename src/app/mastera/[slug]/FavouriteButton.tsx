"use client";

import { useOptimistic, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import s from "@/components/site/site.module.css";
import { setFavouriteMaster } from "../../kabinet/actions";

/** "★ Мой мастер" toggle for a signed-in guest. */
export function FavouriteButton({ staffId, initial }: { staffId: string; initial: boolean }) {
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
          fx.toast(on ? "Убрали из избранного" : "Мастер отмечен как ваш любимый", "MJ");
        })
      }
    >
      {on ? "★ Ваш мастер" : "☆ Мой мастер"}
    </button>
  );
}
