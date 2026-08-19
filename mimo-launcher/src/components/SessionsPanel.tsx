import { launchMimo } from "../api";
import type { LaunchConfig, MimoSession } from "../types";

interface SessionsPanelProps {
  sessions: MimoSession[];
  config: LaunchConfig;
  loading: boolean;
  onRefresh: () => void;
  onStatus: (msg: string, type?: "ok" | "error") => void;
}

export function SessionsPanel({
  sessions,
  config,
  loading,
  onRefresh,
  onStatus,
}: SessionsPanelProps) {
  async function continueSession(session: MimoSession) {
    try {
      await launchMimo({
        ...config,
        session: session.id,
        continue: true,
        mode: "tui",
      });
      onStatus(`Сессия «${session.title}» открыта`, "ok");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Ошибка", "error");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Сессии</h2>
          <p className="mt-1 text-sm text-zinc-500">
            История диалогов с MiMo в проекте {config.project}
          </p>
        </div>
        <button type="button" onClick={onRefresh} className="btn-secondary text-sm">
          🔄 Обновить
        </button>
      </header>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-zinc-500">Загрузка…</div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <p className="text-4xl">💬</p>
          <p className="mt-3 font-medium text-zinc-300">Сессий пока нет</p>
          <p className="mt-1 text-sm text-zinc-600">
            Запустите MiMo Code — история появится здесь
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-200">{session.title}</p>
                <p className="font-mono text-xs text-zinc-600">{session.id}</p>
                {session.date && (
                  <p className="mt-1 text-xs text-zinc-500">{session.date}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => continueSession(session)}
                className="btn-secondary shrink-0 text-sm"
              >
                Продолжить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
