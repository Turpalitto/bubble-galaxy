import { useCallback, useEffect, useState } from "react";
import {
  getAgents,
  getInfo,
  getModels,
  getProviders,
  getSessions,
} from "./api";
import { AgentsPanel } from "./components/AgentsPanel";
import { LaunchPanel } from "./components/LaunchPanel";
import { ModelsPanel } from "./components/ModelsPanel";
import { QuickTasks } from "./components/QuickTasks";
import { SelectionBar } from "./components/SelectionBar";
import { SessionsPanel } from "./components/SessionsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusToast } from "./components/StatusToast";
import { DEFAULT_CONFIG, STORAGE_KEY } from "./constants";
import type { LaunchConfig, MimoAgent, MimoModel, MimoSession, TabId } from "./types";

function loadConfig(): LaunchConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

export default function App() {
  const [tab, setTab] = useState<TabId>("quick");
  const [config, setConfig] = useState<LaunchConfig>(loadConfig);
  const [version, setVersion] = useState("");
  const [mimoBin, setMimoBin] = useState("");
  const [models, setModels] = useState<MimoModel[]>([]);
  const [agents, setAgents] = useState<MimoAgent[]>([]);
  const [sessions, setSessions] = useState<MimoSession[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [providersRaw, setProvidersRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ msg: string; type: "ok" | "error" } | null>(null);

  const patchConfig = useCallback((patch: Partial<LaunchConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const showStatus = useCallback((msg: string, type: "ok" | "error" = "ok") => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 5000);
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await getSessions(config.project);
      setSessions(data.sessions);
    } catch {
      setSessions([]);
    }
  }, [config.project]);

  const refreshProviders = useCallback(async () => {
    try {
      const data = await getProviders();
      setLoggedIn(data.loggedIn);
      setProvidersRaw(data.raw);
    } catch {
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [info, modelsData, agentsData] = await Promise.all([
          getInfo(),
          getModels(),
          getAgents(),
        ]);
        setVersion(info.version);
        setMimoBin(info.mimoBin);
        if (info.defaultProject && config.project === DEFAULT_CONFIG.project) {
          patchConfig({ project: info.defaultProject });
        }
        setModels(modelsData.models);
        setAgents(agentsData.agents);
        if (!modelsData.models.find((m) => m.id === config.model) && modelsData.models[0]) {
          patchConfig({ model: modelsData.models[0].id });
        }
        await Promise.all([refreshSessions(), refreshProviders()]);
      } catch (e) {
        showStatus(
          e instanceof Error ? e.message : "Не удалось подключиться к API. Запустите npm run dev",
          "error",
        );
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, []);

  useEffect(() => {
    if (tab === "sessions") void refreshSessions();
  }, [tab, refreshSessions]);

  return (
    <div className="flex min-h-screen">
      <Sidebar active={tab} onChange={setTab} version={version} />

      <div className="flex min-w-0 flex-1 flex-col">
        <SelectionBar
          model={config.model}
          agent={config.agent}
          models={models}
          agents={agents}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {loading ? (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500" />
              <p className="text-zinc-500">Загрузка панели управления…</p>
            </div>
          ) : (
            <>
              {tab === "launch" && (
                <LaunchPanel config={config} onChange={patchConfig} onStatus={showStatus} />
              )}
              {tab === "quick" && (
                <QuickTasks config={config} onChange={patchConfig} onStatus={showStatus} />
              )}
              {tab === "models" && (
                <ModelsPanel
                  models={models}
                  selected={config.model}
                  onSelect={(model) => {
                    patchConfig({ model });
                    showStatus("Модель выбрана");
                  }}
                  loading={false}
                />
              )}
              {tab === "agents" && (
                <AgentsPanel
                  agents={agents}
                  selected={config.agent}
                  onSelect={(agent) => {
                    patchConfig({ agent });
                    showStatus("Агент выбран");
                  }}
                  loading={false}
                />
              )}
              {tab === "sessions" && (
                <SessionsPanel
                  sessions={sessions}
                  config={config}
                  loading={false}
                  onRefresh={refreshSessions}
                  onStatus={showStatus}
                />
              )}
              {tab === "settings" && (
                <SettingsPanel
                  mimoBin={mimoBin}
                  loggedIn={loggedIn}
                  providersRaw={providersRaw}
                  onStatus={showStatus}
                  onRefresh={refreshProviders}
                />
              )}
            </>
          )}
        </main>
      </div>

      <StatusToast
        message={status?.msg ?? null}
        type={status?.type}
        onClose={() => setStatus(null)}
      />
    </div>
  );
}
