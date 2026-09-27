"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { login, type LoginState } from "./actions";
import s from "./login.module.css";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className={s.form} noValidate>
      <input type="hidden" name="next" value={next} />
      <Field
        label="Логин"
        name="login"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.login}
        required
        autoFocus
      />
      <div className={s.passwordWrap}>
        <Field label="Пароль" name="password" type={show ? "text" : "password"} autoComplete="current-password" required />
        <button type="button" className={s.showBtn} onClick={() => setShow((v) => !v)} aria-pressed={show}>
          {show ? "Скрыть" : "Показать"}
        </button>
      </div>
      {state.error && (
        <div role="alert" className={s.error}>
          {state.error}
        </div>
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? "Входим…" : "Войти"}
      </Button>
    </form>
  );
}
