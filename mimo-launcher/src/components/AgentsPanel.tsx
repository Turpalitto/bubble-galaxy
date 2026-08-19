import { getAgentLabel } from "../constants";
import type { MimoAgent } from "../types";
import { cn } from "../utils";

interface AgentsPanelProps {
  agents: MimoAgent[];
  selected: string;
  onSelect: (id: string) => void;
  loading: boolean;
}

export function AgentsPanel({ agents, selected, onSelect, loading }: AgentsPanelProps) {
  const primary = agents.filter((a) => a.role === "primary");
  const subagents = agents.filter((a) => a.role === "subagent");

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-zinc-500">Загрузка агентов…</div>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-white">Агенты</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Агенты — специализированные режимы работы MiMo для разных типов задач
        </p>
      </header>

      <AgentGroup
        title="Основные агенты"
        subtitle="Для повседневной работы — выбирайте один из них"
        agents={primary}
        selected={selected}
        onSelect={onSelect}
      />

      <AgentGroup
        title="Вспомогательные агенты"
        subtitle="Используются автоматически или для узких задач"
        agents={subagents}
        selected={selected}
        onSelect={onSelect}
        compact
      />
    </div>
  );
}

function AgentGroup({
  title,
  subtitle,
  agents,
  selected,
  onSelect,
  compact,
}: {
  title: string;
  subtitle: string;
  agents: MimoAgent[];
  selected: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-zinc-200">{title}</h3>
      <p className="mb-4 text-sm text-zinc-600">{subtitle}</p>
      <div className={cn("grid gap-3", compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
        {agents.map((agent) => {
          const label = getAgentLabel(agent);
          const isSelected = selected === agent.id;

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelect(agent.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                isSelected
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-white/8 bg-white/[0.02] hover:border-white/15",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-white">{label.title}</span>
                {isSelected && (
                  <span className="text-xs text-orange-400">✓</span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{label.description}</p>
              <p className="mt-2 font-mono text-[10px] text-zinc-600">{agent.id}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
