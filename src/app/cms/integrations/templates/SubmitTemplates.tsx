"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { submitWhatsappTemplates } from "./actions";
import s from "./templates.module.css";

/** Sends all WhatsApp templates to Meta for review and shows what happened. */
export function SubmitTemplates({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Awaited<ReturnType<typeof submitWhatsappTemplates>> | null>(null);
  return (
    <div className={s.submit}>
      <Button
        disabled={pending || !configured}
        onClick={() =>
          start(async () => {
            setResult(await submitWhatsappTemplates());
            router.refresh();
          })
        }
      >
        {pending ? "Отправляем…" : "Отправить шаблоны в Meta"}
      </Button>
      {!configured && <span className={s.small}>Нужны WHATSAPP_TOKEN и WHATSAPP_WABA_ID в .env — см. docs/whatsapp-setup.md</span>}
      {result && (
        <div role="status" className={s.small}>
          {result.error ??
            (result.ok
              ? `Готово: отправлено ${result.results.filter((r) => r.status !== "EXISTS").length}, уже были ${result.results.filter((r) => r.status === "EXISTS").length}.`
              : `Ошибки: ${result.results
                  .filter((r) => r.status === "ERROR")
                  .map((r) => `${r.name} (${r.language}): ${r.error}`)
                  .join("; ")}`)}
        </div>
      )}
    </div>
  );
}
