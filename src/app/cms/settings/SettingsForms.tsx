"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SectionHead } from "@/components/ui/Headings";
import { changeOwnPassword, resetUserPassword, saveSettings, setUserActive } from "./actions";
import s from "./settings.module.css";

const LABELS: Record<string, string> = {
  "salon.name": "Название",
  "salon.branch": "Филиал (в шапке CMS)",
  "salon.address": "Адрес",
  "salon.phone": "Телефон",
  "salon.instagram": "Instagram",
  "salon.hours": "Часы работы",
};

export function SalonForm({ initial }: { initial: Record<string, string> }) {
  const fx = useFx();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettings(values);
          if (!res.ok) return setError(res.error);
          setError("");
          setSaved(true);
          fx.toast("Настройки салона сохранены");
          router.refresh();
        });
      }}
    >
      {Object.keys(LABELS).map((k) => (
        <Field
          key={k}
          label={LABELS[k]}
          value={values[k] ?? ""}
          onChange={(e) => {
            setSaved(false);
            setValues({ ...values, [k]: e.target.value });
          }}
        />
      ))}
      <Field label="Валюта" value="сомони (TJS)" readOnly hint="(фиксировано)" />
      {error && <div className={s.error}>{error}</div>}
      <div className={s.actions}>
        <Button type="submit" disabled={pending}>
          Сохранить
        </Button>
        {saved && <span className={s.saved}>✦ Сохранено</span>}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const fx = useFx();
  const [f, setF] = useState({ current: "", next: "", repeat: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (f.next !== f.repeat) return setError("Пароли не совпадают");
        start(async () => {
          const res = await changeOwnPassword(f.current, f.next);
          if (!res.ok) return setError(res.error);
          setError("");
          setF({ current: "", next: "", repeat: "" });
          fx.toast("Пароль изменён");
        });
      }}
    >
      <Field label="Текущий пароль" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <div className={s.two}>
        <Field label="Новый пароль" hint="(от 8 символов)" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        <Field label="Ещё раз" type="password" autoComplete="new-password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} />
      </div>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.actions}>
        <Button type="submit" variant="ink" disabled={pending}>
          Сменить пароль
        </Button>
      </div>
    </form>
  );
}

type TeamUser = { id: string; name: string; login: string; roleLabel: string; active: boolean; me: boolean };

export function TeamList({ users }: { users: TeamUser[] }) {
  const fx = useFx();
  const router = useRouter();
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div>
      <SectionHead title="Команда и доступ" />
      <div className={s.team}>
        {users.map((u) => (
          <div key={u.id} className={`${s.member} ${u.active ? "" : s.off}`}>
            <div className={s.memberMain}>
              <b>{u.name}</b> · {u.roleLabel}
              <small>
                логин: {u.login}
                {!u.active && " · отключён"}
              </small>
            </div>
            {!u.me && (
              <div className={s.memberActions}>
                <button type="button" onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setPw(""); setError(""); }}>
                  Новый пароль
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await setUserActive(u.id, !u.active);
                      if (!res.ok) return fx.toast(res.error);
                      fx.toast(u.active ? `${u.name}: доступ отключён` : `${u.name}: доступ включён`);
                      router.refresh();
                    })
                  }
                >
                  {u.active ? "Отключить" : "Включить"}
                </button>
              </div>
            )}
            {resetFor === u.id && (
              <div className={s.reset}>
                <input type="text" placeholder="Новый пароль (от 8 символов)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" />
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await resetUserPassword(u.id, pw);
                      if (!res.ok) return setError(res.error);
                      setResetFor(null);
                      fx.toast(`${u.name}: пароль обновлён, старые входы завершены`);
                    })
                  }
                >
                  Сохранить
                </Button>
                {error && <div className={s.error}>{error}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
