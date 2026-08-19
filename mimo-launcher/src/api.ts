import type { LaunchConfig, MimoAgent, MimoModel, MimoSession } from "./types";

const API = "/api";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
  return data as T;
}

export async function getInfo() {
  return fetchJson<{
    version: string;
    mimoBin: string;
    defaultProject: string;
    exists: boolean;
  }>(`${API}/info`);
}

export async function getModels() {
  return fetchJson<{ models: MimoModel[] }>(`${API}/models`);
}

export async function getAgents() {
  return fetchJson<{ agents: MimoAgent[] }>(`${API}/agents`);
}

export async function getSessions(project: string) {
  return fetchJson<{ sessions: MimoSession[] }>(
    `${API}/sessions?project=${encodeURIComponent(project)}`,
  );
}

export async function getProviders() {
  return fetchJson<{ loggedIn: boolean; raw: string; credentialsPath: string }>(
    `${API}/providers`,
  );
}

export async function launchMimo(
  config: LaunchConfig & { mode?: string; message?: string; port?: number },
) {
  return fetchJson<{ launched: boolean; command: string }>(`${API}/launch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export async function runMimo(
  config: LaunchConfig & { message: string },
) {
  return fetchJson<{ ok: boolean; output: string }>(`${API}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export async function loginProvider(url?: string) {
  return fetchJson<{ launched: boolean }>(`${API}/providers/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}
