import type { TagTone } from "@/components/ui/Tag";

export const appointmentStatus: Record<string, { label: string; tone: TagTone }> = {
  DONE: { label: "Готово", tone: "done" },
  IN_CHAIR: { label: "В кресле", tone: "chair" },
  CONFIRMED: { label: "Придёт", tone: "confirmed" },
  PENDING: { label: "Ожидание", tone: "pending" },
  CANCELLED: { label: "Отменена", tone: "done" },
  NO_SHOW: { label: "Не пришла", tone: "done" },
};

export const guestTag: Record<string, { label: string; tone: TagTone }> = {
  VIP: { label: "VIP", tone: "chair" },
  BRIDE: { label: "Невеста", tone: "confirmed" },
  REGULAR: { label: "Постоянная", tone: "done" },
  NEW: { label: "Новая", tone: "pending" },
};

export const paymentMethod: Record<string, string> = { CASH: "Наличные", CARD: "Карта", QR: "QR" };
