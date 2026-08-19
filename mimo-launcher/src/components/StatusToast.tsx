import { cn } from "../utils";

interface StatusToastProps {
  message: string | null;
  type?: "ok" | "error";
  onClose: () => void;
}

export function StatusToast({ message, type = "ok", onClose }: StatusToastProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur",
        type === "ok"
          ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-100"
          : "border-red-500/30 bg-red-950/90 text-red-100",
      )}
    >
      <span className="text-lg">{type === "ok" ? "✓" : "✕"}</span>
      <p className="flex-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="text-white/50 hover:text-white"
        aria-label="Закрыть"
      >
        ×
      </button>
    </div>
  );
}
