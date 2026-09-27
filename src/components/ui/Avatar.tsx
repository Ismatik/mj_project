import { initials } from "@/lib/format";
import s from "./ui.module.css";

const SIZES = { sm: [32, 11], md: [44, 14], lg: [48, 16] } as const;

/** Square ink tile with gold serif initials. */
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZES }) {
  const [box, font] = SIZES[size];
  return (
    <span className={s.avatar} style={{ width: box, height: box, fontSize: font }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
