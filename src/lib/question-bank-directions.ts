/** Направления собеседования — фильтр в общем банке вопросов. */
export const QUESTION_BANK_DIRECTION_SEEDS = [
  { slug: "general", label: "Универсальное", sortOrder: 0 },
  { slug: "backend", label: "Разработка: бэкенд", sortOrder: 10 },
  { slug: "frontend", label: "Разработка: фронтенд", sortOrder: 20 },
  { slug: "fullstack", label: "Разработка: fullstack", sortOrder: 30 },
  { slug: "data", label: "Data / аналитика", sortOrder: 40 },
  { slug: "product", label: "Product", sortOrder: 50 },
  { slug: "qa", label: "QA / тестирование", sortOrder: 60 },
  { slug: "devops", label: "DevOps / инфраструктура", sortOrder: 70 },
  { slug: "design", label: "UX / UI / дизайн", sortOrder: 80 },
  { slug: "management", label: "Менеджмент", sortOrder: 90 },
  { slug: "hr", label: "HR / рекрутинг", sortOrder: 100 },
  { slug: "sales", label: "Sales", sortOrder: 110 },
  { slug: "marketing", label: "Маркетинг", sortOrder: 120 },
] as const;
