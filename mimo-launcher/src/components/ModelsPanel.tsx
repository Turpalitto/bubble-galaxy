import { getModelLabel } from "../constants";
import type { MimoModel } from "../types";
import { cn } from "../utils";

interface ModelsPanelProps {
  models: MimoModel[];
  selected: string;
  onSelect: (id: string) => void;
  loading: boolean;
}

export function ModelsPanel({ models, selected, onSelect, loading }: ModelsPanelProps) {
  if (loading) {
    return <LoadingState text="Загрузка моделей…" />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Модели ИИ</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Выберите модель для работы. Нажмите на карточку — она применится при запуске.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {models.map((model) => {
          const label = getModelLabel(model.id);
          const isSelected = selected === model.id;

          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onSelect(model.id)}
              className={cn(
                "rounded-2xl border p-5 text-left transition-all",
                isSelected
                  ? "border-orange-500/50 bg-orange-500/10 ring-1 ring-orange-500/30"
                  : "border-white/8 bg-white/[0.02] hover:border-white/15",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-white">{label.title}</h3>
                {isSelected && (
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-medium text-white">
                    Выбрано
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">{label.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{model.provider}</Badge>
                {model.reasoning && <Badge variant="accent">Рассуждения</Badge>}
                <Badge variant={model.status === "active" ? "green" : "muted"}>
                  {model.status === "active" ? "Активна" : model.status}
                </Badge>
              </div>
              <p className="mt-2 font-mono text-xs text-zinc-600">{model.id}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Badge({
  children,
  variant = "muted",
}: {
  children: React.ReactNode;
  variant?: "muted" | "accent" | "green";
}) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs",
        variant === "accent" && "bg-orange-500/20 text-orange-300",
        variant === "green" && "bg-emerald-500/20 text-emerald-300",
        variant === "muted" && "bg-white/5 text-zinc-500",
      )}
    >
      {children}
    </span>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-zinc-500">{text}</div>
  );
}
