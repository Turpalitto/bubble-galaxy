import { getAgentLabel, getModelLabel } from "../constants";
import type { MimoAgent, MimoModel } from "../types";

interface SelectionBarProps {
  model: string;
  agent: string;
  models: MimoModel[];
  agents: MimoAgent[];
}

export function SelectionBar({ model, agent, models, agents }: SelectionBarProps) {
  const modelMeta = models.find((m) => m.id === model);
  const agentMeta = agents.find((a) => a.id === agent);
  const modelLabel = getModelLabel(model);
  const agentLabel = agentMeta ? getAgentLabel(agentMeta) : null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-white/8 bg-[#0d0d14]/80 px-6 py-3 backdrop-blur">
      <Chip icon="🧠" label="Модель" value={modelMeta?.name ?? modelLabel.title} />
      <Chip icon="🤖" label="Агент" value={agentLabel?.title ?? agent} />
      <Chip icon="📁" label="Проект" value="BUBBLEGAME" small />
    </div>
  );
}

function Chip({
  icon,
  label,
  value,
  small,
}: {
  icon: string;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5">
      <span>{icon}</span>
      <span className="text-xs text-zinc-500">{label}:</span>
      <span className={`font-medium text-zinc-200 ${small ? "text-xs" : "text-sm"}`}>{value}</span>
    </div>
  );
}
