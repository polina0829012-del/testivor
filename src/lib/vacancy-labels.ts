export const PRIORITY_LABEL: Record<string, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочно",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  active: "В работе",
  on_hold: "Пауза",
  closed: "Деактивирована",
};

/** Подпись статуса для UI: закрытая вакансия с зафиксированным наймом — отдельная формулировка. */
export function vacancyStatusDisplayLabel(status: string, hiredCandidateId?: string | null): string {
  if (status === "closed" && hiredCandidateId) return "Закрыта с наймом";
  return STATUS_LABEL[status] ?? status;
}

export const WORK_FORMAT_LABEL: Record<string, string> = {
  "": "Не указано",
  office: "Офис",
  hybrid: "Гибрид",
  remote: "Удалённо",
};
