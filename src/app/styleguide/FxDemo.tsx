"use client";

import { useRef, useState } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function FxDemo() {
  const fx = useFx();
  const area = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState("");
  const digits = phone.replace(/\D/g, "").replace(/^992/, "");
  const phoneError = phone && digits.length !== 9 ? "Нужно 9 цифр, например 98 103 11 11" : undefined;

  return (
    <div ref={area} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button onClick={() => fx.runLoader(1900, "Открываем салон…")}>Лоадер</Button>
        <Button variant="ink" onClick={() => fx.toast("Настройки салона сохранены")}>
          Уведомление
        </Button>
        <Button variant="outline" onClick={(e) => fx.sparkle(e.currentTarget)}>
          Золотые искры
        </Button>
        <Button variant="outline" onClick={() => fx.skeleton(area.current, 900)}>
          Skeleton
        </Button>
      </div>
      <div style={{ maxWidth: 420 }}>
        <Field label="Телефон" hint="(9 цифр)" placeholder="+992 98 103 11 11" value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneError} />
      </div>
    </div>
  );
}
