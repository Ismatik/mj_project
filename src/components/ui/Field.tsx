"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import s from "./ui.module.css";

type FieldProps = { label: ReactNode; hint?: ReactNode; error?: string };

export function Field({ label, hint, error, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={input.id ?? id} className={s.fieldLabel} style={{ display: "block" }}>
        {label} {hint && <span className={s.fieldHint}>{hint}</span>}
      </label>
      <input id={input.id ?? id} className={s.input} aria-invalid={!!error} {...input} />
      {error && <div className={s.fieldError}>{error}</div>}
    </div>
  );
}

export function TextArea({ label, hint, error, ...input }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={input.id ?? id} className={s.fieldLabel} style={{ display: "block" }}>
        {label} {hint && <span className={s.fieldHint}>{hint}</span>}
      </label>
      <textarea id={input.id ?? id} className={s.input} aria-invalid={!!error} {...input} />
      {error && <div className={s.fieldError}>{error}</div>}
    </div>
  );
}

export const inputClass = s.input;
