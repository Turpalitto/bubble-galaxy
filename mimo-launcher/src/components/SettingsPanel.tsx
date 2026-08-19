import { loginProvider } from "../api";

interface SettingsPanelProps {
  mimoBin: string;
  loggedIn: boolean;
  providersRaw: string;
  onStatus: (msg: string, type?: "ok" | "error") => void;
  onRefresh: () => void;
}

export function SettingsPanel({
  mimoBin,
  loggedIn,
  providersRaw,
  onStatus,
  onRefresh,
}: SettingsPanelProps) {
  async function handleLogin() {
    try {
      await loginProvider();
      onStatus("Окно входа в провайдер открыто в терминале", "ok");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Ошибка", "error");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Настройки</h2>
        <p className="mt-1 text-sm text-zinc-500">Провайдеры, пути и системная информация</p>
      </header>

      <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 space-y-4">
        <h3 className="font-semibold text-zinc-200">Провайдер ИИ</h3>
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${loggedIn ? "bg-emerald-400" : "bg-red-400"}`}
          />
          <span className="text-sm text-zinc-400">
            {loggedIn ? "Аккаунт подключён" : "Не авторизован — войдите для работы"}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleLogin} className="btn-primary text-sm">
            🔑 Войти в провайдер
          </button>
          <button type="button" onClick={onRefresh} className="btn-secondary text-sm">
            Проверить статус
          </button>
        </div>
        {providersRaw && (
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-zinc-500">
            {providersRaw}
          </pre>
        )}
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 space-y-3">
        <h3 className="font-semibold text-zinc-200">Система</h3>
        <Row label="Путь к MiMo" value={mimoBin} mono />
        <Row label="Адрес панели" value="http://127.0.0.1:3847" mono />
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="mb-2 font-semibold text-zinc-200">Документация</h3>
        <a
          href="https://mimo.xiaomi.com/coder/docs"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          mimo.xiaomi.com/coder/docs →
        </a>
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={`text-sm text-zinc-300 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
