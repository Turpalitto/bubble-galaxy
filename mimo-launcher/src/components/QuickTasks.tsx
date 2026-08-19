import { useState } from "react";
import { launchMimo } from "../api";
import { QUICK_TASKS } from "../constants";
import type { LaunchConfig } from "../types";
import { cn } from "../utils";

interface QuickTasksProps {
  config: LaunchConfig;
  onChange: (patch: Partial<LaunchConfig>) => void;
  onStatus: (msg: string, type?: "ok" | "error") => void;
}

export function QuickTasks({ config, onChange, onStatus }: QuickTasksProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function startTask(task: (typeof QUICK_TASKS)[number]) {
    setLoading(task.id);
    onChange({ agent: task.agent, prompt: task.prompt });
    try {
      await launchMimo({
        ...config,
        agent: task.agent,
        prompt: task.prompt,
        mode: "tui",
      });
      onStatus(`Задача «${task.title}» запущена в MiMo Code`, "ok");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Ошибка", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Быстрые задачи</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Выберите готовый сценарий — MiMo откроется с нужным агентом и промптом
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK_TASKS.map((task) => (
          <button
            key={task.id}
            type="button"
            disabled={loading !== null}
            onClick={() => startTask(task)}
            className={cn(
              "group rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-left transition-all hover:border-orange-500/30 hover:bg-orange-500/5",
              loading === task.id && "border-orange-500/50 bg-orange-500/10",
            )}
          >
            <div className="mb-3 flex items-start justify-between">
              <span className="text-2xl">{task.icon}</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-500">
                {task.agent}
              </span>
            </div>
            <h3 className="font-semibold text-white group-hover:text-orange-200">
              {loading === task.id ? "Запуск…" : task.title}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">{task.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
