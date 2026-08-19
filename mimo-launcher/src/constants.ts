import type { MimoAgent } from "./types";

export const AGENT_LABELS: Record<string, { title: string; description: string }> = {
  build: {
    title: "Сборка",
    description: "Основной агент для написания и изменения кода",
  },
  compose: {
    title: "Композиция",
    description: "Сборка функций из нескольких частей, комплексные задачи",
  },
  plan: {
    title: "Планирование",
    description: "Планирование крупных изменений перед реализацией",
  },
  explore: {
    title: "Исследование",
    description: "Быстрый обзор кодовой базы и поиск нужных файлов",
  },
  general: {
    title: "Универсальный",
    description: "Общие задачи без узкой специализации",
  },
  review: {
    title: "Ревью",
    description: "Проверка кода и поиск проблем",
  },
  debug: {
    title: "Отладка",
    description: "Поиск и исправление багов",
  },
  distill: {
    title: "Сжатие",
    description: "Сокращение и упрощение кода",
  },
  dream: {
    title: "Генерация идей",
    description: "Креативные предложения и варианты решений",
  },
  summary: {
    title: "Резюме",
    description: "Краткое изложение изменений и контекста",
  },
  title: {
    title: "Заголовки",
    description: "Генерация названий для сессий и задач",
  },
  "checkpoint-writer": {
    title: "Чекпоинты",
    description: "Сохранение промежуточного состояния работы",
  },
  compaction: {
    title: "Компактификация",
    description: "Сжатие длинного контекста сессии",
  },
};

export const MODEL_LABELS: Record<string, { title: string; description: string }> = {
  "mimo/mimo-auto": {
    title: "MiMo Auto",
    description: "Автовыбор лучшей модели для задачи",
  },
  "xiaomi/mimo-v2.5": {
    title: "MiMo v2.5",
    description: "Быстрая модель для повседневных задач",
  },
  "xiaomi/mimo-v2.5-pro": {
    title: "MiMo v2.5 Pro",
    description: "Мощная модель с рассуждениями для сложных задач",
  },
  "xiaomi/mimo-v2.5-pro-ultraspeed": {
    title: "MiMo Pro UltraSpeed",
    description: "Максимальная скорость при высоком качестве",
  },
};

export const QUICK_TASKS = [
  {
    id: "fix-bug",
    icon: "🐛",
    title: "Исправить баг",
    description: "Найти и устранить ошибку в проекте",
    agent: "build",
    prompt: "Найди и исправь баг в этом проекте. Сначала воспроизведи проблему, затем исправь и проверь.",
  },
  {
    id: "new-feature",
    icon: "✨",
    title: "Новая функция",
    description: "Добавить новую возможность в игру",
    agent: "build",
    prompt: "Помоги добавить новую функцию в проект. Сначала предложи план, затем реализуй по шагам.",
  },
  {
    id: "refactor",
    icon: "🔧",
    title: "Рефакторинг",
    description: "Улучшить структуру кода без изменения поведения",
    agent: "build",
    prompt: "Проведи рефакторинг кода: улучши читаемость и структуру, не ломая существующую логику.",
  },
  {
    id: "explore",
    icon: "🔍",
    title: "Изучить проект",
    description: "Понять структуру и архитектуру",
    agent: "explore",
    prompt: "Изучи структуру этого проекта и кратко объясни архитектуру, основные модули и точки входа.",
  },
  {
    id: "plan",
    icon: "📋",
    title: "Составить план",
    description: "Спланировать крупное изменение",
    agent: "plan",
    prompt: "Составь детальный план реализации задачи. Разбей на этапы с оценкой рисков.",
  },
  {
    id: "review",
    icon: "👁",
    title: "Ревью кода",
    description: "Проверить качество и найти проблемы",
    agent: "review",
    prompt: "Проведи ревью кода проекта: найди баги, уязвимости и места для улучшения.",
  },
  {
    id: "optimize",
    icon: "⚡",
    title: "Оптимизация",
    description: "Ускорить производительность игры",
    agent: "build",
    prompt: "Проанализируй производительность проекта и предложи оптимизации для игрового движка и рендеринга.",
  },
  {
    id: "ui",
    icon: "🎨",
    title: "Улучшить UI",
    description: "Сделать интерфейс красивее и удобнее",
    agent: "build",
    prompt: "Улучши пользовательский интерфейс: современный дизайн, анимации, адаптивность.",
  },
] as const;

export function getAgentLabel(agent: MimoAgent) {
  const meta = AGENT_LABELS[agent.id];
  const roleLabel = agent.role === "primary" ? "Основной" : "Вспомогательный";
  return {
    title: meta?.title ?? agent.id,
    description: meta?.description ?? `Агент ${agent.id}`,
    roleLabel,
  };
}

export function getModelLabel(id: string) {
  return MODEL_LABELS[id] ?? {
    title: id.split("/")[1] ?? id,
    description: `Модель ${id}`,
  };
}

export const STORAGE_KEY = "mimo-launcher-config";

export const DEFAULT_CONFIG = {
  project: "C:\\BUBBLEGAME",
  model: "xiaomi/mimo-v2.5",
  agent: "build",
  prompt: "",
  session: "",
  continue: false,
  fork: false,
  trust: true,
  neverAsk: false,
};
