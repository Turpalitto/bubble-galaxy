import { useState } from "react";
import { launchMimo } from "../api";
import type { LaunchConfig } from "../types";
import { cn } from "../utils";

interface LaunchPanelProps {
  config: LaunchConfig;
  onChange: (patch: Partial<LaunchConfig>) => void;
  onStatus: (msg: string, type?: "ok" | "error") => void;
}

export function LaunchPanel({ config, onChange, onStatus }: LaunchPanelProps) {
  const [launching, setLaunching] = useState(false);

  async function handleLaunch(mode: "tui" | "serve" = "tui") {
    setLaunching(true);
    try {
      const result = await launchMimo({ ...config, mode });
      onStatus(
        mode === "serve"
          ? "Сервер MiMo запущен в отдельном окне терминала"
          : "MiMo Code открыт в новом окне терминала",
        "ok",
      );
      void result;
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Ошибка запуска", "error");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Запуск MiMo Code</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Выберите параметры и откройте терминал с нужными настройками
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Папка проекта" hint="Рабочая директория для MiMo">
          <input
            type="text"
            value={config.project}
            onChange={(e) => onChange({ project: e.target.value })}
            className="input"
            placeholder="C:\BUBBLEGAME"
          />
        </Field>

        <Field label="Начальный промпт" hint="Необязательно — первое сообщение агенту">
          <input
            type="text"
            value={config.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            className="input"
            placeholder="Например: изучи структуру проекта"
          />
        </Field>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-300">Дополнительные опции</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle
            label="Доверять папке"
            hint="Пропустить запрос доверия"
            checked={config.trust}
            onChange={(trust) => onChange({ trust })}
          />
          <Toggle
            label="Авто-режим"
            hint="Не спрашивать подтверждения"
            checked={config.neverAsk}
            onChange={(neverAsk) => onChange({ neverAsk })}
          />
          <Toggle
            label="Продолжить сессию"
            hint="Возобновить последнюю"
            checked={config.continue}
            onChange={(cont) => onChange({ continue: cont })}
          />
          <Toggle
            label="Форк сессии"
            hint="Копия при продолжении"
            checked={config.fork}
            onChange={(fork) => onChange({ fork })}
            disabled={!config.continue && !config.session}
          />
        </div>

        {config.session && (
          <div className="mt-4">
            <Field label="ID сессии">
              <input
                type="text"
                value={config.session}
                onChange={(e) => onChange({ session: e.target.value })}
                className="input"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={launching}
          onClick={() => handleLaunch("tui")}
          className="btn-primary"
        >
          {launching ? "Запуск…" : "🚀 Открыть MiMo Code"}
        </button>
        <button
          type="button"
          disabled={launching}
          onClick={() => handleLaunch("serve")}
          className="btn-secondary"
        >
          🌐 Запустить сервер
        </button>
      </div>

      <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-sm text-orange-200/80">
        <strong className="text-orange-300">Подсказка:</strong> MiMo откроется в отдельном окне
        терминала. Там вы сможете общаться с ИИ в интерактивном режиме.
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      {hint && <span className="block text-xs text-zinc-600">{hint}</span>}
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "rounded-xl border p-3 text-left transition-all",
        disabled && "cursor-not-allowed opacity-40",
        checked
          ? "border-orange-500/40 bg-orange-500/10"
          : "border-white/8 bg-white/[0.02] hover:border-white/15",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span
          className={cn(
            "h-5 w-9 rounded-full p-0.5 transition-colors",
            checked ? "bg-orange-500" : "bg-zinc-700",
          )}
        >
          <span
            className={cn(
              "block h-4 w-4 rounded-full bg-white transition-transform",
              checked && "translate-x-4",
            )}
          />
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </button>
  );
}
