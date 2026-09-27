import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import s from "./ui.module.css";

type Variant = "gold" | "ink" | "outline" | "outlineGold";
type Size = "md" | "sm";

type Common = { variant?: Variant; size?: Size; block?: boolean };

const cls = ({ variant = "gold", size = "md", block }: Common, extra?: string) =>
  [s.btn, s[variant], s[size], block ? s.block : "", extra ?? ""].filter(Boolean).join(" ");

export function Button({ variant, size, block, className, type = "button", ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cls({ variant, size, block }, className)} {...rest} />;
}

export function ButtonLink({ variant, size, block, className, ...rest }: Common & ComponentProps<typeof Link>) {
  return <Link className={cls({ variant, size, block }, className)} {...rest} />;
}
