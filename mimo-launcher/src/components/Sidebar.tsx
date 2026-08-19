import { cn } from "../utils";
import type { TabId } from "../types";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "launch", label: "Запуск", icon: "🚀" },
  { id: "quick", label: "Быстрые задачи", icon: "⚡" },
  { id: "models", label: "Модели", icon: "🧠" },
  { id: "agents", label: "Агенты", icon: "🤖" },
  { id: "sessions", label: "Сессии", icon: "💬" },
  { id: "settings", label: "Настройки", icon: "⚙️" },
];

interface SidebarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  version: string;
}

export function Sidebar({ active, onChange, version }: SidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/8 bg-[#0d0d14]">
      <div className="border-b border-white/8 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-lg font-bold text-white shadow-lg shadow-orange-500/20">
            M
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">MiMo Code</h1>
            <p className="text-xs text-zinc-500">Панель управления</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
              active === tab.id
                ? "bg-orange-500/15 text-orange-300 shadow-inner"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
            )}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-white/8 p-4">
        <p className="text-xs text-zinc-600">Версия MiMo</p>
        <p className="text-sm font-medium text-zinc-400">{version || "…"}</p>
      </div>
    </aside>
  );
}
